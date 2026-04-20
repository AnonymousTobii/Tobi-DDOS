#!/usr/bin/env python3
"""
TOBI v5.0 - Advanced Proxy Scraper
Multi-threaded, auto-validating, fresh proxy fetcher
Far superior to basic MegaMedusa scraper
"""

import os
import sys
import re
import time
import json
import asyncio
import aiohttp
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from datetime import datetime
from colorama import Fore, init, Style

# Initialize colorama
init(autoreset=True)

# Colors
R = Fore.RED
G = Fore.GREEN
Y = Fore.YELLOW
C = Fore.CYAN
M = Fore.MAGENTA
W = Fore.WHITE
B = Fore.BLUE
S = Style.BRIGHT
RESET = Fore.RESET

# Banner
BANNER = f"""
{S}{C}╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ███████╗ ██████╗██████╗  █████╗ ██████╗ ███████╗
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝
║      ██║   ██║   ██║██████╔╝██║    ███████╗██║     ██████╔╝███████║██████╔╝█████╗  
║      ██║   ██║   ██║██╔══██╗██║    ╚════██║██║     ██╔══██╗██╔══██║██╔═══╝ ██╔══╝  
║      ██║   ╚██████╔╝██████╔╝██║    ███████║╚██████╗██║  ██║██║  ██║██║     ███████╗
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝
║                                                                          ║
║                    🔥 TOBI v5.0 - PROXY SCRAPER 🔥                       ║
║                 Multi-Threaded | Auto-Validating | Fresh                 ║
╚══════════════════════════════════════════════════════════════════════════╝{RESET}
"""

# Proxy sources (50+ sources - far more than MegaMedusa)
PROXY_SOURCES = [
    # GitHub Raw Sources
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks4.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks5.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks4/socks4.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks5/socks5.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks4.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/socks4.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/socks5.txt',
    'https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/https_proxies.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/socks4_proxies.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/socks5_proxies.txt',
    'https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.json',
    'https://raw.githubusercontent.com/alexmon1989/russia_proxy_list/main/proxy_list.txt',
    
    # API Sources
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://api.proxyscrape.com/?request=displayproxies&proxytype=http',
    'https://api.proxyscrape.com/?request=displayproxies&proxytype=socks4',
    'https://api.proxyscrape.com/?request=displayproxies&proxytype=socks5',
    'https://proxy.webshare.io/api/v2/proxy/list/download/',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://www.proxy-list.download/api/v1/get?type=socks4',
    'https://www.proxy-list.download/api/v1/get?type=socks5',
    
    # Raw Text Sources
    'http://worm.rip/http.txt',
    'http://worm.rip/socks4.txt',
    'http://worm.rip/socks5.txt',
    'https://proxyspace.pro/http.txt',
    'https://multiproxy.org/txt_all/proxy.txt',
    'https://proxy-spider.com/api/proxies.example.txt',
    'https://spys.me/proxy.txt',
    'https://spys.one/en/proxy-list.txt',
    'https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt',
    'https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks4.txt',
    'https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks5.txt',
]

# Validation settings
VALIDATION_TIMEOUT = 5
VALIDATION_URLS = [
    'http://httpbin.org/ip',
    'https://httpbin.org/ip',
    'http://api.ipify.org',
    'https://api.ipify.org'
]
MAX_WORKERS = 50
TEST_URL = 'http://httpbin.org/get'

class ProxyScraper:
    def __init__(self):
        self.proxies = set()
        self.valid_proxies = []
        self.lock = threading.Lock()
        self.total_fetched = 0
        
    def print_progress(self, current, total, source):
        """Display progress bar"""
        percent = (current / total) * 100 if total > 0 else 0
        bar_length = 40
        filled = int(bar_length * percent / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        sys.stdout.write(f'\r{C}📡 Progress: {bar} {percent:.1f}% | {current}/{total} | {Y}{source[:50]}{RESET}')
        sys.stdout.flush()
    
    def fetch_proxy_list(self, url):
        """Fetch proxies from a single source"""
        proxies = []
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, timeout=15, headers=headers)
            if response.status_code == 200:
                content = response.text
                # Extract IP:PORT patterns
                pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b'
                matches = re.findall(pattern, content)
                for match in matches:
                    ip_port = match.strip()
                    if self.validate_ip_port(ip_port):
                        proxies.append(ip_port)
                print(f"{G}✓ Found {len(matches)} proxies from {url[:60]}{RESET}")
            else:
                print(f"{R}✗ Failed: {url[:60]} (Status: {response.status_code}){RESET}")
        except Exception as e:
            print(f"{R}✗ Error: {url[:60]} - {str(e)[:30]}{RESET}")
        return proxies
    
    def validate_ip_port(self, proxy):
        """Validate proxy format"""
        pattern = r'^(\d{1,3}\.){3}\d{1,3}:\d{2,5}$'
        if not re.match(pattern, proxy):
            return False
        try:
            ip, port = proxy.split(':')
            octets = ip.split('.')
            for octet in octets:
                if not 0 <= int(octet) <= 255:
                    return False
            if not 1 <= int(port) <= 65535:
                return False
            return True
        except:
            return False
    
    def validate_proxy(self, proxy):
        """Test if proxy actually works"""
        try:
            proxies = {'http': f'http://{proxy}', 'https': f'http://{proxy}'}
            start_time = time.time()
            response = requests.get(TEST_URL, proxies=proxies, timeout=VALIDATION_TIMEOUT)
            response_time = (time.time() - start_time) * 1000
            if response.status_code == 200:
                return (proxy, response_time)
        except:
            pass
        return None
    
    def scrape_all(self):
        """Scrape proxies from all sources"""
        print(f"\n{C}{S}🚀 Starting proxy scraping from {len(PROXY_SOURCES)} sources...{RESET}\n")
        
        all_proxies = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(self.fetch_proxy_list, url): url for url in PROXY_SOURCES}
            
            for i, future in enumerate(as_completed(futures), 1):
                source = futures[future]
                try:
                    proxies = future.result()
                    all_proxies.extend(proxies)
                    self.print_progress(i, len(PROXY_SOURCES), source)
                except Exception as e:
                    print(f"{R}✗ Failed: {source[:50]} - {str(e)[:30]}{RESET}")
        
        # Deduplicate
        self.proxies = set(all_proxies)
        print(f"\n\n{G}✓ Total unique proxies scraped: {len(self.proxies)}{RESET}")
        return self.proxies
    
    def validate_all(self):
        """Validate all scraped proxies"""
        print(f"\n{C}{S}🔍 Validating {len(self.proxies)} proxies...{RESET}\n")
        
        valid = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(self.validate_proxy, proxy): proxy for proxy in self.proxies}
            
            for i, future in enumerate(as_completed(futures), 1):
                proxy = futures[future]
                try:
                    result = future.result()
                    if result:
                        proxy, response_time = result
                        valid.append(proxy)
                        sys.stdout.write(f"\r{G}✓ Valid: {len(valid)}/{len(self.proxies)} | {C}Response: {response_time:.0f}ms{RESET}")
                    else:
                        sys.stdout.write(f"\r{Y}⏳ Testing: {i}/{len(self.proxies)}{RESET}")
                    sys.stdout.flush()
                except:
                    pass
        
        self.valid_proxies = valid
        print(f"\n\n{G}✓ Valid working proxies: {len(self.valid_proxies)}{RESET}")
        return self.valid_proxies
    
    def save_proxies(self, filename='proxy.txt'):
        """Save proxies to file with metadata"""
        with open(filename, 'w') as f:
            f.write(f"# TOBI Proxy List - Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Total working proxies: {len(self.valid_proxies)}\n")
            f.write(f"# Sources: {len(PROXY_SOURCES)}\n")
            f.write("# ================================================\n\n")
            for proxy in self.valid_proxies:
                f.write(f"{proxy}\n")
        
        print(f"\n{G}{S}✓ Saved {len(self.valid_proxies)} proxies to {filename}{RESET}")
        
        # Also save as JSON for better parsing
        json_data = {
            'timestamp': datetime.now().isoformat(),
            'total': len(self.valid_proxies),
            'sources_count': len(PROXY_SOURCES),
            'proxies': self.valid_proxies
        }
        with open('proxy.json', 'w') as f:
            json.dump(json_data, f, indent=2)
        print(f"{G}✓ Also saved to proxy.json{RESET}")

def display_stats(scraper):
    """Display scraping statistics"""
    print(f"\n{C}{S}╔════════════════════════════════════════════════════════════╗")
    print(f"║                    SCRAPING STATISTICS                       ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"""
    {G}📊 Total Sources:     {W}{len(PROXY_SOURCES)}
    {G}📥 Scraped Proxies:   {W}{len(scraper.proxies):,}
    {G}✅ Valid Proxies:     {W}{len(scraper.valid_proxies):,}
    {G}📁 Output Files:      {W}proxy.txt, proxy.json
    {G}⏱️  Validation Time:   {W}{VALIDATION_TIMEOUT}s timeout
    {G}🚀 Concurrency:       {W}{MAX_WORKERS} threads
    """)

def main():
    """Main execution"""
    os.system('cls' if os.name == 'nt' else 'clear')
    print(BANNER)
    
    scraper = ProxyScraper()
    
    # Scrape proxies
    scraper.scrape_all()
    
    if len(scraper.proxies) == 0:
        print(f"{R}❌ No proxies scraped! Check your internet connection.{RESET}")
        sys.exit(1)
    
    # Validate proxies
    scraper.validate_all()
    
    # Save results
    scraper.save_proxies()
    
    # Display stats
    display_stats(scraper)
    
    # Ask if user wants to use proxies immediately
    if len(scraper.valid_proxies) > 0:
        print(f"\n{C}{S}🚀 TOBI is ready with {len(scraper.valid_proxies)} working proxies!{RESET}")
        try:
            start = input(f"\n{C}Start TOBI with these proxies? (y/n): {RESET}")
            if start.lower() == 'y':
                os.system('node Tobi.js')
        except:
            pass

if __name__ == "__main__":
    try:
        import requests
        main()
    except ImportError:
        print(f"{R}❌ Missing 'requests' module. Installing...{RESET}")
        os.system('pip install requests')
        os.execv(sys.executable, ['python'] + sys.argv)
    except KeyboardInterrupt:
        print(f"\n{Y}⚠️ Scraping interrupted by user{RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"{R}❌ Error: {e}{RESET}")
        sys.exit(1)