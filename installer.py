#!/usr/bin/env python3
"""
TOBI v5.0 - Advanced Installation Script
FIXED for Kali Linux / Debian / Ubuntu
No permission errors, no Termux commands
"""

import os
import sys
import platform
import subprocess
import time
import json
import shutil
from pathlib import Path

# Colors
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'
    CLEAR = '\033[2J\033[H'

def print_banner():
    """Display installation banner"""
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
║              Fixed for Kali Linux | No Permission Errors                 ║
╚══════════════════════════════════════════════════════════════════════════╝
""" + Colors.RESET)
    print(f"\n{Colors.CYAN}📊 System Information:{Colors.RESET}")
    print(f"   OS: {platform.system()} {platform.release()}")
    print(f"   Python: {sys.version.split()[0]}")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"   Node.js: {result.stdout.strip()}")
        else:
            print(f"   Node.js: {Colors.YELLOW}Not installed{Colors.RESET}")
    except:
        print(f"   Node.js: {Colors.YELLOW}Not installed{Colors.RESET}")
    print()

def run_command(cmd, description, use_sudo=False):
    """Run shell command with progress indication"""
    print(f"{Colors.YELLOW}⚙️  {description}...{Colors.RESET}", end=" ", flush=True)
    try:
        if use_sudo and os.geteuid() != 0:
            cmd = ['sudo'] + cmd if isinstance(cmd, list) else f"sudo {cmd}"
        
        result = subprocess.run(cmd if isinstance(cmd, list) else cmd.split(), 
                               capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f"{Colors.GREEN}✓{Colors.RESET}")
            return True
        else:
            print(f"{Colors.RED}✗{Colors.RESET}")
            if result.stderr:
                print(f"    {Colors.DIM}{result.stderr[:100]}{Colors.RESET}")
            return False
    except subprocess.TimeoutExpired:
        print(f"{Colors.RED}✗ (Timeout){Colors.RESET}")
        return False
    except Exception as e:
        print(f"{Colors.RED}✗ ({str(e)[:30]}){Colors.RESET}")
        return False

def setup_npm_permissions():
    """Fix npm permissions for current user"""
    print(f"\n{Colors.CYAN}🔧 Setting up npm permissions...{Colors.RESET}")
    
    home = str(Path.home())
    
    # Create local npm directory
    npm_global = os.path.join(home, '.npm-global')
    os.makedirs(npm_global, exist_ok=True)
    
    # Update npm config
    subprocess.run(['npm', 'config', 'set', 'prefix', npm_global], capture_output=True)
    
    # Add to PATH in bashrc
    bashrc = os.path.join(home, '.bashrc')
    path_line = f'\nexport PATH={npm_global}/bin:$PATH\n'
    
    with open(bashrc, 'a') as f:
        f.write(path_line)
    
    # Update current PATH
    os.environ['PATH'] = f"{npm_global}/bin:{os.environ.get('PATH', '')}"
    
    print(f"{Colors.GREEN}✓ npm configured for local user{Colors.RESET}")
    print(f"{Colors.DIM}   Global packages will go to: {npm_global}{Colors.RESET}")

def install_nodejs_kali():
    """Install Node.js on Kali Linux"""
    print(f"\n{Colors.CYAN}📦 Installing Node.js on Kali Linux...{Colors.RESET}")
    
    # Check if Node.js is already installed
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"{Colors.GREEN}✓ Node.js already installed: {result.stdout.strip()}{Colors.RESET}")
            return True
    except:
        pass
    
    # Install via curl (NodeSource)
    commands = [
        (['curl', '-fsSL', 'https://deb.nodesource.com/setup_20.x', '-o', '/tmp/node_setup.sh'], "Downloading NodeSource setup"),
        (['bash', '/tmp/node_setup.sh'], "Running NodeSource setup"),
        (['apt-get', 'update', '-qq'], "Updating package list"),
        (['apt-get', 'install', '-y', '-qq', 'nodejs'], "Installing Node.js"),
    ]
    
    for cmd, desc in commands:
        if not run_command(cmd, desc, use_sudo=True):
            print(f"{Colors.RED}Failed to install Node.js{Colors.RESET}")
            return False
    
    # Cleanup
    os.remove('/tmp/node_setup.sh')
    
    # Verify
    result = subprocess.run(['node', '--version'], capture_output=True, text=True)
    print(f"{Colors.GREEN}✓ Node.js {result.stdout.strip()} installed{Colors.RESET}")
    return True

def install_npm_packages():
    """Install npm packages locally (no sudo)"""
    print(f"\n{Colors.CYAN}📦 Installing npm packages...{Colors.RESET}")
    
    # Create package.json if it doesn't exist
    if not os.path.exists('package.json'):
        package_json = {
            "name": "tobi",
            "version": "5.0.0",
            "description": "TOBI - Load Testing Framework",
            "main": "Tobi.js",
            "dependencies": {}
        }
        with open('package.json', 'w') as f:
            json.dump(package_json, f, indent=2)
    
    # Install packages one by one (avoid permission issues)
    packages = [
        'axios', 'chalk', 'figlet', 'gradient-string',
        'https-proxy-agent', 'socks-proxy-agent', 'user-agents',
        'progress', 'blessed', 'blessed-contrib', 'ws'
    ]
    
    # Initialize npm if needed
    if not os.path.exists('node_modules'):
        run_command(['npm', 'init', '-y'], "Initializing npm")
    
    success_count = 0
    for pkg in packages:
        if run_command(['npm', 'install', pkg, '--save', '--no-audit', '--no-fund'], f"Installing {pkg}"):
            success_count += 1
    
    print(f"\n{Colors.GREEN}✓ Installed {success_count}/{len(packages)} packages{Colors.RESET}")
    return success_count

def install_python_packages():
    """Install Python packages"""
    print(f"\n{Colors.CYAN}🐍 Installing Python packages...{Colors.RESET}")
    
    packages = ['requests', 'beautifulsoup4', 'lxml', 'colorama']
    
    for pkg in packages:
        run_command([sys.executable, '-m', 'pip', 'install', pkg, '-q'], f"Installing {pkg}")
    
    print(f"{Colors.GREEN}✓ Python packages installed{Colors.RESET}")

def create_scraper_script():
    """Create simplified proxy scraper (no external deps needed)"""
    scraper_code = '''#!/usr/bin/env python3
"""TOBI Proxy Scraper - Simplified version"""

import urllib.request
import re
import sys

SOURCES = [
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
]

def scrape():
    proxies = set()
    for url in SOURCES:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode()
                matches = re.findall(r'\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:\\d{2,5}\\b', content)
                for m in matches:
                    proxies.add(m)
            print(f"Found {len(matches)} from {url[:50]}")
        except:
            pass
    return list(proxies)

if __name__ == "__main__":
    print("Scraping proxies...")
    proxies = scrape()
    with open('proxy.txt', 'w') as f:
        for p in proxies:
            f.write(f"{p}\\n")
    print(f"Saved {len(proxies)} proxies to proxy.txt")
'''
    
    with open('scrape.py', 'w') as f:
        f.write(scraper_code)
    os.chmod('scrape.py', 0o755)
    print(f"{Colors.GREEN}✓ Created proxy scraper{Colors.RESET}")

def create_tobi_launcher():
    """Create a launcher script with proper permissions"""
    launcher = '''#!/bin/bash
# TOBI Launcher
cd "$(dirname "$0")"
export NODE_OPTIONS="--max-old-space-size=4096"
node Tobi.js "$@"
'''
    with open('tobi.sh', 'w') as f:
        f.write(launcher)
    os.chmod('tobi.sh', 0o755)
    print(f"{Colors.GREEN}✓ Created launcher script (./tobi.sh){Colors.RESET}")

def main():
    """Main installation routine"""
    print_banner()
    
    # Check if running as root (not recommended for npm)
    if os.geteuid() == 0:
        print(f"{Colors.YELLOW}⚠️  Running as root. npm will use global installation.{Colors.RESET}")
        print(f"{Colors.YELLOW}   It's better to run without sudo for local packages.{Colors.RESET}\n")
    
    # Step 1: Setup npm permissions
    if os.geteuid() != 0:
        setup_npm_permissions()
    
    # Step 2: Install Node.js if needed
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
        print(f"\n{Colors.GREEN}✓ Node.js is already installed{Colors.RESET}")
    except:
        install_nodejs_kali()
    
    # Step 3: Install npm packages
    install_npm_packages()
    
    # Step 4: Install Python packages
    install_python_packages()
    
    # Step 5: Create additional files
    create_scraper_script()
    create_tobi_launcher()
    
    # Final success message
    print(f"\n{Colors.GREEN}{Colors.BOLD}")
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║                    INSTALLATION COMPLETE!                      ║")
    print("╠════════════════════════════════════════════════════════════════╣")
    print("║                                                                ║")
    print("║  🚀 TOBI is ready to launch!                                  ║")
    print("║                                                                ║")
    print("║  Usage:                                                        ║")
    print("║    ./tobi.sh              - Run with launcher                  ║")
    print("║    node Tobi.js           - Run directly                       ║")
    print("║    python3 scrape.py      - Scrape fresh proxies               ║")
    print("║                                                                ║")
    print("║  Quick Start:                                                  ║")
    print("║    ./tobi.sh                                                   ║")
    print("║    Then enter your target domain when prompted                 ║")
    print("║                                                                ║")
    print("║  ⚠️  AUTHORIZED USE ONLY - Target: 10.0.0.1                   ║")
    print("║                                                                ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print(Colors.RESET)
    
    # Ask to run TOBI
    try:
        start = input(f"\n{Colors.CYAN}🚀 Start TOBI now? (y/n): {Colors.RESET}")
        if start.lower() == 'y':
            os.system('node Tobi.js')
    except KeyboardInterrupt:
        pass
    except:
        pass

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️ Installation cancelled{Colors.RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Colors.RED}❌ Error: {e}{Colors.RESET}")
        sys.exit(1)
