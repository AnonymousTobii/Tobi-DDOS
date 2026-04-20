#!/usr/bin/env python3
"""
TOBI v5.0 - Fixed Proxy Scraper
No permission errors, working API endpoints
"""

import urllib.request
import urllib.error
import re
import os
import sys

# Colors
G = '\033[92m'
R = '\033[91m'
Y = '\033[93m'
C = '\033[96m'
BOLD = '\033[1m'
RESET = '\033[0m'

print(f"{C}{BOLD}")
print("╔══════════════════════════════════════════════════════════════════════════╗")
print("║                    🔥 TOBI v5.0 - PROXY SCRAPER 🔥                        ║")
print("╚══════════════════════════════════════════════════════════════════════════╝")
print(f"{RESET}")

# Working proxy sources (updated URLs)
SOURCES = [
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
    'https://multiproxy.org/txt_all/proxy.txt',
    'https://proxy-spider.com/api/proxies.example.txt',
]

def fetch_proxies(url):
    """Fetch proxies from a single source"""
    proxies = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read().decode('utf-8', errors='ignore')
            # Extract IP:PORT patterns
            matches = re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b', content)
            proxies.extend(matches)
            if matches:
                print(f"{G}✓ Found {len(matches)} proxies from {url[:50]}{RESET}")
            else:
                print(f"{Y}⚠ No proxies from {url[:50]}{RESET}")
    except urllib.error.URLError as e:
        print(f"{R}✗ Failed: {url[:50]} - {str(e.reason)[:30]}{RESET}")
    except Exception as e:
        print(f"{R}✗ Error: {url[:50]} - {str(e)[:30]}{RESET}")
    return proxies

def main():
    # Change to home directory where we have write permission
    os.chdir(os.path.expanduser('~'))
    
    all_proxies = set()
    
    print(f"\n{Y}📡 Fetching from {len(SOURCES)} sources...{RESET}\n")
    
    for i, url in enumerate(SOURCES, 1):
        print(f"{C}[{i}/{len(SOURCES)}]{RESET} Fetching {url[:60]}...")
        proxies = fetch_proxies(url)
        all_proxies.update(proxies)
    
    print(f"\n{C}📊 Total unique proxies scraped: {len(all_proxies)}{RESET}")
    
    # Save to home directory
    output_file = os.path.expanduser('~/proxy.txt')
    with open(output_file, 'w') as f:
        for proxy in all_proxies:
            f.write(f"{proxy}\n")
    
    print(f"{G}✓ Saved {len(all_proxies)} proxies to {output_file}{RESET}")
    
    # Also save to current directory if possible
    try:
        with open('proxy.txt', 'w') as f:
            for proxy in all_proxies:
                f.write(f"{proxy}\n")
        print(f"{G}✓ Also saved to ./proxy.txt{RESET}")
    except PermissionError:
        print(f"{Y}⚠ Could not save to current directory (permission denied){RESET}")
        print(f"{Y}   Proxies saved to: {output_file}{RESET}")
    
    print(f"\n{G}{BOLD}✅ Proxy scraping complete!{RESET}")
    print(f"   Total proxies: {len(all_proxies)}")
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
