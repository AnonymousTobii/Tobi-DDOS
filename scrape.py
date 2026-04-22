#!/usr/bin/env python3
"""
TOBI v6.0 - Advanced Proxy Scraper & Validator
Multi-source scraping with concurrent validation
"""

import urllib.request
import urllib.error
import re
import os
import sys
import threading
import time
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed

# Colors
G = '\033[92m'
R = '\033[91m'
Y = '\033[93m'
C = '\033[96m'
BOLD = '\033[1m'
RESET = '\033[0m'

print(f"{C}{BOLD}")
print("╔══════════════════════════════════════════════════════════════════════════╗")
print("║              🔥 TOBI v6.0 - PROXY SCRAPER & VALIDATOR 🔥                 ║")
print("║               Multi-source | Concurrent | Self-validating                ║")
print("╚══════════════════════════════════════════════════════════════════════════╝")
print(f"{RESET}")

# Working proxy sources (curated and maintained)
SOURCES = [
    # GitHub raw lists (most reliable)
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies.txt',
    'https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt',
    # Additional sources
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://www.proxy-list.download/api/v1/get?type=https',
    'https://www.proxy-list.download/api/v1/get?type=socks4',
    'https://www.proxy-list.download/api/v1/get?type=socks5',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/socks5.txt',
    'https://raw.githubusercontent.com/saschazesiger/Free-Proxies/master/proxies/http.txt',
    'https://raw.githubusercontent.com/saschazesiger/Free-Proxies/master/proxies/socks4.txt',
    'https://raw.githubusercontent.com/saschazesiger/Free-Proxies/master/proxies/socks5.txt',
]

# Validation timeout
VALIDATION_TIMEOUT = 5
TEST_URL = 'http://httpbin.org/ip'  # or 'https://api.ipify.org?format=json'

def fetch_proxies(url):
    """Fetch proxies from a single source with retry"""
    proxies = []
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read().decode('utf-8', errors='ignore')
            # Extract IP:PORT patterns (more robust regex)
            matches = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b', content)
            proxies = list(set(matches))  # deduplicate per source
            if proxies:
                print(f"{G}✓ Found {len(proxies)} proxies from {url[:60]}{RESET}")
            else:
                print(f"{Y}⚠ No proxies from {url[:60]}{RESET}")
    except urllib.error.URLError as e:
        print(f"{R}✗ Failed: {url[:60]} - {str(e.reason)[:30]}{RESET}")
    except Exception as e:
        print(f"{R}✗ Error: {url[:60]} - {str(e)[:30]}{RESET}")
    return proxies

def validate_proxy(proxy):
    """Test if proxy works by making a request"""
    proxy_type = 'http'  # assume http/https
    proxy_handler = urllib.request.ProxyHandler({
        'http': f'http://{proxy}',
        'https': f'http://{proxy}'
    })
    opener = urllib.request.build_opener(proxy_handler)
    opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
    try:
        start = time.time()
        with opener.open(TEST_URL, timeout=VALIDATION_TIMEOUT) as resp:
            if resp.status == 200:
                elapsed = time.time() - start
                return proxy, True, elapsed
    except:
        pass
    return proxy, False, None

def main():
    # Change to home directory for write permission
    os.chdir(os.path.expanduser('~'))
    
    print(f"\n{Y}📡 Fetching from {len(SOURCES)} sources concurrently...{RESET}\n")
    
    # Fetch all proxies concurrently
    all_proxies = set()
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_proxies, url): url for url in SOURCES}
        for future in as_completed(futures):
            proxies = future.result()
            all_proxies.update(proxies)
    
    print(f"\n{C}📊 Total unique proxies scraped: {len(all_proxies)}{RESET}")
    
    if not all_proxies:
        print(f"{R}❌ No proxies found!{RESET}")
        sys.exit(1)
    
    # Ask if user wants to validate
    validate = input(f"\n{Y}🔍 Validate proxies? (y/n, default n): {RESET}").lower() == 'y'
    
    if validate:
        print(f"\n{C}🔍 Validating {len(all_proxies)} proxies (timeout {VALIDATION_TIMEOUT}s)...{RESET}")
        working_proxies = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = {executor.submit(validate_proxy, proxy): proxy for proxy in all_proxies}
            for i, future in enumerate(as_completed(futures), 1):
                proxy, is_working, delay = future.result()
                if is_working:
                    working_proxies.append(proxy)
                    print(f"{G}✓ [{i}/{len(all_proxies)}] {proxy} ({delay:.2f}s){RESET}")
                else:
                    print(f"{R}✗ [{i}/{len(all_proxies)}] {proxy}{RESET}")
        all_proxies = set(working_proxies)
        print(f"\n{G}✅ Validated: {len(all_proxies)} working proxies{RESET}")
    
    # Save to file
    output_file = os.path.expanduser('~/proxy.txt')
    with open(output_file, 'w') as f:
        for proxy in all_proxies:
            f.write(f"{proxy}\n")
    
    print(f"\n{G}✓ Saved {len(all_proxies)} proxies to {output_file}{RESET}")
    
    # Also save to current directory if possible
    try:
        with open('proxy.txt', 'w') as f:
            for proxy in all_proxies:
                f.write(f"{proxy}\n")
        print(f"{G}✓ Also saved to ./proxy.txt{RESET}")
    except PermissionError:
        print(f"{Y}⚠ Could not save to current directory (permission denied){RESET}")
    
    print(f"\n{G}{BOLD}✅ Proxy scraping complete!{RESET}")
    print(f"   Total working proxies: {len(all_proxies)}")
    print(f"   Location: {output_file}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Y}⚠ Interrupted by user{RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"{R}❌ Error: {e}{RESET}")
        sys.exit(1)
