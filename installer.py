#!/usr/bin/env python3
"""
TOBI v5.0 - Advanced Installation Script
Multi-platform support with dependency management
Far superior to MegaMedusa installer
"""

import os
import sys
import platform
import subprocess
import time
import json
from typing import List, Tuple

# Colors for terminal
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    RESET = '\033[0m'
    CLEAR = '\033[2J\033[H'

def print_banner():
    """Display TOBI installation banner"""
    print(Colors.CLEAR)
    print(Colors.MAGENTA + Colors.BOLD + """
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ████████╗ ██████╗ ██████╗ ██╗    ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗
║   ╚══██╔══╝██╔═══██╗██╔══██╗██║    ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║
║      ██║   ██║   ██║██████╔╝██║    ██║██╔██╗ ██║███████╗   ██║   ███████║██║
║      ██║   ██║   ██║██╔══██╗██║    ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║
║      ██║   ╚██████╔╝██████╔╝██║    ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗
║      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝    ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
║                                                                          ║
║                    🔥 TOBI v5.0 - INSTALLATION SCRIPT 🔥                 ║
║                      Ultimate Load Testing Framework                      ║
╚══════════════════════════════════════════════════════════════════════════╝
""" + Colors.RESET)
    print(f"\n{Colors.CYAN}📦 Starting TOBI Installation...{Colors.RESET}\n")

def get_system_info():
    """Detect system information"""
    system = platform.system()
    arch = platform.machine()
    python_version = sys.version.split()[0]
    node_version = "Not installed"
    
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            node_version = result.stdout.strip()
    except:
        pass
    
    return {
        'os': system,
        'arch': arch,
        'python': python_version,
        'node': node_version
    }

def run_command(cmd: List[str], description: str) -> bool:
    """Run shell command with progress indication"""
    print(f"{Colors.YELLOW}⚙️  {description}...{Colors.RESET}", end=" ", flush=True)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            print(f"{Colors.GREEN}✓{Colors.RESET}")
            return True
        else:
            print(f"{Colors.RED}✗{Colors.RESET}")
            if result.stderr:
                print(f"    Error: {result.stderr[:100]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"{Colors.RED}✗ (Timeout){Colors.RESET}")
        return False
    except Exception as e:
        print(f"{Colors.RED}✗ ({str(e)[:50]}){Colors.RESET}")
        return False

def install_node_dependencies():
    """Install Node.js dependencies with better error handling"""
    print(f"\n{Colors.CYAN}📦 Installing Node.js Dependencies...{Colors.RESET}")
    
    dependencies = [
        'axios', 'cluster', 'crypto', 'fs', 'http2', 'https', 'net', 'os', 
        'path', 'tls', 'url', 'events', 'http-proxy-agent', 'https-proxy-agent',
        'socks-proxy-agent', 'user-agents', 'progress', 'chalk', 'figlet', 
        'gradient-string', 'blessed', 'blessed-contrib', 'ws', 'express', 
        'socket.io', 'puppeteer', 'playwright', 'cheerio', 'pino', 'winston'
    ]
    
    success_count = 0
    for dep in dependencies:
        if run_command(['npm', 'install', dep, '--silent', '--no-progress'], f"Installing {dep}"):
            success_count += 1
    
    print(f"\n{Colors.GREEN}✓ Installed {success_count}/{len(dependencies)} packages{Colors.RESET}")
    return success_count

def install_python_dependencies():
    """Install Python dependencies for proxy scraper"""
    print(f"\n{Colors.CYAN}🐍 Installing Python Dependencies...{Colors.RESET}")
    
    python_deps = [
        'requests', 'beautifulsoup4', 'lxml', 'aiohttp', 'asyncio', 
        'colorama', 'tqdm', 'fake-useragent', 'selenium', 'scrapy'
    ]
    
    for dep in python_deps:
        run_command([sys.executable, '-m', 'pip', 'install', dep, '-q'], f"Installing {dep}")
    
    print(f"{Colors.GREEN}✓ Python dependencies installed{Colors.RESET}")

def create_proxy_scraper():
    """Create advanced proxy scraper script"""
    scraper_code = '''#!/usr/bin/env python3
"""
TOBI Proxy Scraper - Auto-fetch fresh proxies from multiple sources
"""

import requests
import json
import re
import time
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

PROXY_SOURCES = [
    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies.txt",
]

def fetch_proxies():
    proxies = set()
    for url in PROXY_SOURCES:
        try:
            r = requests.get(url, timeout=10)
            for line in r.text.split('\\n'):
                line = line.strip()
                if line and not line.startswith('#'):
                    if re.match(r'^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:\\d+$', line):
                        proxies.add(line)
        except:
            continue
    return list(proxies)

def save_proxies(proxies):
    with open('proxy.txt', 'w') as f:
        for proxy in proxies:
            f.write(f"{proxy}\\n")
    print(f"Saved {len(proxies)} proxies to proxy.txt")

if __name__ == "__main__":
    print("Scraping fresh proxies...")
    proxies = fetch_proxies()
    save_proxies(proxies)
'''
    
    with open('scrape.py', 'w') as f:
        f.write(scraper_code)
    print(f"{Colors.GREEN}✓ Created advanced proxy scraper{Colors.RESET}")

def create_optimization_script():
    """Create system optimization script"""
    opt_code = '''#!/bin/bash
# TOBI System Optimizer

echo "🔧 Optimizing system for TOBI..."

# Increase file limits
ulimit -n 999999
ulimit -u unlimited

# Network optimizations
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_tw_reuse=1
sysctl -w net.ipv4.tcp_fin_timeout=30
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sysctl -w net.core.netdev_max_backlog=65535

echo "✓ System optimized"
'''
    
    with open('optimize.sh', 'w') as f:
        f.write(opt_code)
    os.chmod('optimize.sh', 0o755)
    print(f"{Colors.GREEN}✓ Created optimization script{Colors.RESET}")

def main():
    """Main installation routine"""
    print_banner()
    
    # System info
    info = get_system_info()
    print(f"{Colors.BLUE}📊 System Information:{Colors.RESET}")
    print(f"   OS: {info['os']} ({info['arch']})")
    print(f"   Python: {info['python']}")
    print(f"   Node.js: {info['node']}")
    print()
    
    # Check Node.js
    if info['node'] == "Not installed":
        print(f"{Colors.YELLOW}⚠️  Node.js not found! Installing...{Colors.RESET}")
        if platform.system() == "Android" or "termux" in os.environ.get('PREFIX', ''):
            run_command(['pkg', 'install', 'nodejs-lts', '-y'], "Installing Node.js")
        elif platform.system() == "Linux":
            run_command(['curl', '-fsSL', 'https://deb.nodesource.com/setup_20.x', '|', 'bash'], "Adding NodeSource repo")
            run_command(['apt-get', 'install', '-y', 'nodejs'], "Installing Node.js")
        elif platform.system() == "Darwin":
            run_command(['brew', 'install', 'node@20'], "Installing Node.js")
    
    # Install dependencies
    install_node_dependencies()
    install_python_dependencies()
    
    # Create additional files
    create_proxy_scraper()
    create_optimization_script()
    
    # Create package.json if missing
    if not os.path.exists('package.json'):
        package_json = {
            "name": "tobi",
            "version": "5.0.0",
            "description": "TOBI - Advanced Load Testing Framework",
            "main": "Tobi.js",
            "scripts": {
                "start": "node Tobi.js",
                "install": "python3 installer.py",
                "scrape": "python3 scrape.py",
                "optimize": "bash optimize.sh"
            }
        }
        with open('package.json', 'w') as f:
            json.dump(package_json, f, indent=2)
        print(f"{Colors.GREEN}✓ Created package.json{Colors.RESET}")
    
    # Final success message
    print(f"\n{Colors.GREEN}{Colors.BOLD}")
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║                    INSTALLATION COMPLETE!                      ║")
    print("╠════════════════════════════════════════════════════════════════╣")
    print("║                                                                ║")
    print("║  🚀 TOBI is ready to launch!                                  ║")
    print("║                                                                ║")
    print("║  Usage:                                                        ║")
    print("║    node Tobi.js              - Interactive mode               ║")
    print("║    node Tobi.js <url> <time> <workers> - Direct mode          ║")
    print("║    python3 scrape.py         - Scrape fresh proxies           ║")
    print("║    bash optimize.sh          - Optimize system                ║")
    print("║                                                                ║")
    print("║  ⚠️  AUTHORIZED USE ONLY - Target: 10.0.0.1                   ║")
    print("║                                                                ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print(Colors.RESET)
    
    # Auto-start prompt
    try:
        start = input(f"\n{Colors.CYAN}🚀 Start TOBI now? (y/n): {Colors.RESET}")
        if start.lower() == 'y':
            os.system('node Tobi.js')
    except:
        pass

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️ Installation cancelled{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}❌ Installation error: {e}{Colors.RESET}")