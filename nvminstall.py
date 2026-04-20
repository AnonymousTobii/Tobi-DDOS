#!/usr/bin/env python3
"""
TOBI v5.0 - Advanced Node Version Manager Installer
Multi-platform Node.js installation with version management
Far superior to basic MegaMedusa nvminstall.py
"""

import os
import sys
import platform
import subprocess
import time
import json
import urllib.request
import tarfile
import zipfile
import tempfile
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

# Node.js versions
NODE_VERSIONS = {
    'lts': '20.11.0',
    'latest': '21.6.0',
    'stable': '20.11.0',
    'legacy': '16.20.2'
}

# Download mirrors
MIRRORS = [
    'https://nodejs.org/dist',
    'https://mirrors.aliyun.com/nodejs-release',
    'https://npmmirror.com/mirrors/node'
]

class NVMInstaller:
    def __init__(self):
        self.system = platform.system()
        self.arch = platform.machine()
        self.is_termux = 'com.termux' in os.environ.get('PREFIX', '')
        self.home = str(Path.home())
        self.nvm_dir = os.path.join(self.home, '.nvm')
        self.node_dir = os.path.join(self.home, '.node')
        
    def print_banner(self):
        """Display installation banner"""
        print(Colors.CLEAR)
        print(Colors.MAGENTA + Colors.BOLD + """
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ███╗   ██╗██╗   ██╗███╗   ███╗    ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗
║   ████╗  ██║██║   ██║████╗ ████║    ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║
║   ██╔██╗ ██║██║   ██║██╔████╔██║    ██║██╔██╗ ██║███████╗   ██║   ███████║██║
║   ██║╚██╗██║██║   ██║██║╚██╔╝██║    ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║
║   ██║ ╚████║╚██████╔╝██║ ╚═╝ ██║    ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗
║   ╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
║                                                                          ║
║              🔥 TOBI v5.0 - NODE VERSION MANAGER INSTALLER 🔥            ║
║                   Multi-Platform Node.js Installation                     ║
╚══════════════════════════════════════════════════════════════════════════╝
""" + Colors.RESET)
        
        print(f"\n{Colors.CYAN}📊 System Information:{Colors.RESET}")
        print(f"   OS: {self.system} ({self.arch})")
        print(f"   Home: {self.home}")
        print(f"   Termux: {self.is_termux}")
        print()

    def run_command(self, cmd, description, capture=False):
        """Run shell command with progress indication"""
        print(f"{Colors.YELLOW}⚙️  {description}...{Colors.RESET}", end=" ", flush=True)
        try:
            if capture:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
                if result.returncode == 0:
                    print(f"{Colors.GREEN}✓{Colors.RESET}")
                    return result.stdout.strip()
                else:
                    print(f"{Colors.RED}✗{Colors.RESET}")
                    return None
            else:
                result = subprocess.run(cmd, shell=True, timeout=300)
                if result.returncode == 0:
                    print(f"{Colors.GREEN}✓{Colors.RESET}")
                    return True
                else:
                    print(f"{Colors.RED}✗{Colors.RESET}")
                    return False
        except subprocess.TimeoutExpired:
            print(f"{Colors.RED}✗ (Timeout){Colors.RESET}")
            return None if capture else False
        except Exception as e:
            print(f"{Colors.RED}✗ ({str(e)[:30]}){Colors.RESET}")
            return None if capture else False

    def install_nvm_linux(self):
        """Install NVM on Linux/Mac"""
        print(f"\n{Colors.CYAN}📦 Installing NVM on Linux/Mac...{Colors.RESET}")
        
        # Remove existing NVM
        if os.path.exists(self.nvm_dir):
            shutil.rmtree(self.nvm_dir)
        
        # Clone NVM repository
        clone_cmd = f'git clone https://github.com/nvm-sh/nvm.git "{self.nvm_dir}"'
        if self.run_command(clone_cmd, "Cloning NVM repository"):
            # Source NVM
            bashrc = os.path.join(self.home, '.bashrc')
            zshrc = os.path.join(self.home, '.zshrc')
            
            nvm_source = f'\nexport NVM_DIR="{self.nvm_dir}"\n[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"\n'
            
            for rc_file in [bashrc, zshrc]:
                if os.path.exists(rc_file) or rc_file == bashrc:
                    with open(rc_file, 'a') as f:
                        f.write(nvm_source)
            
            # Source NVM for current session
            os.environ['NVM_DIR'] = self.nvm_dir
            nvm_sh = os.path.join(self.nvm_dir, 'nvm.sh')
            if os.path.exists(nvm_sh):
                with open(nvm_sh, 'r') as f:
                    exec(f.read())
            
            return True
        return False

    def install_nvm_windows(self):
        """Install Node.js on Windows (nvm-windows)"""
        print(f"\n{Colors.CYAN}📦 Installing Node.js on Windows...{Colors.RESET}")
        
        # Download nvm-windows installer
        nvm_url = "https://github.com/coreybutler/nvm-windows/releases/download/1.1.12/nvm-setup.exe"
        installer_path = os.path.join(tempfile.gettempdir(), "nvm-setup.exe")
        
        print(f"{Colors.YELLOW}📥 Downloading nvm-windows...{Colors.RESET}")
        try:
            urllib.request.urlretrieve(nvm_url, installer_path)
            print(f"{Colors.GREEN}✓ Downloaded{Colors.RESET}")
            
            # Run installer silently
            os.system(f'"{installer_path}" /S')
            time.sleep(5)
            os.remove(installer_path)
            return True
        except Exception as e:
            print(f"{Colors.RED}✗ Failed: {e}{Colors.RESET}")
            return False

    def install_nvm_termux(self):
        """Install Node.js on Termux (Android)"""
        print(f"\n{Colors.CYAN}📦 Installing Node.js on Termux...{Colors.RESET}")
        
        commands = [
            ('pkg update -y', "Updating packages"),
            ('pkg upgrade -y', "Upgrading packages"),
            ('pkg install nodejs-lts -y', "Installing Node.js LTS"),
            ('pkg install nodejs -y', "Installing Node.js latest"),
            ('npm install -g npm@latest', "Updating npm")
        ]
        
        success_count = 0
        for cmd, desc in commands:
            if self.run_command(cmd, desc):
                success_count += 1
        
        return success_count >= 3

    def install_node_direct(self, version='lts'):
        """Direct Node.js installation without NVM"""
        print(f"\n{Colors.CYAN}📦 Direct Node.js installation...{Colors.RESET}")
        
        node_version = NODE_VERSIONS.get(version, NODE_VERSIONS['lts'])
        
        # Determine filename based on OS
        if self.system == 'Linux':
            if self.arch == 'x86_64':
                filename = f'node-v{node_version}-linux-x64.tar.xz'
            elif self.arch == 'aarch64':
                filename = f'node-v{node_version}-linux-arm64.tar.xz'
            elif self.arch == 'armv7l':
                filename = f'node-v{node_version}-linux-armv7l.tar.xz'
            else:
                filename = f'node-v{node_version}-linux-x64.tar.xz'
        elif self.system == 'Darwin':
            filename = f'node-v{node_version}-darwin-x64.tar.gz'
        else:
            print(f"{Colors.RED}✗ Unsupported platform for direct install{Colors.RESET}")
            return False
        
        # Try mirrors
        for mirror in MIRRORS:
            url = f"{mirror}/v{node_version}/{filename}"
            print(f"{Colors.YELLOW}📥 Trying: {url[:60]}...{Colors.RESET}")
            
            try:
                download_path = os.path.join(tempfile.gettempdir(), filename)
                urllib.request.urlretrieve(url, download_path)
                
                # Extract
                extract_dir = self.node_dir
                os.makedirs(extract_dir, exist_ok=True)
                
                if filename.endswith('.tar.xz'):
                    import lzma
                    with tarfile.open(download_path, 'r:xz') as tar:
                        tar.extractall(extract_dir)
                elif filename.endswith('.tar.gz'):
                    with tarfile.open(download_path, 'r:gz') as tar:
                        tar.extractall(extract_dir)
                
                # Add to PATH
                node_bin = os.path.join(extract_dir, f'node-v{node_version}-*', 'bin')
                paths = list(Path(extract_dir).glob(f'node-v{node_version}-*/bin'))
                if paths:
                    os.environ['PATH'] = f"{paths[0]}:{os.environ['PATH']}"
                
                os.remove(download_path)
                print(f"{Colors.GREEN}✓ Node.js {node_version} installed{Colors.RESET}")
                return True
                
            except Exception as e:
                print(f"{Colors.DIM}Failed: {str(e)[:50]}{Colors.RESET}")
                continue
        
        return False

    def verify_installation(self):
        """Verify Node.js and npm installation"""
        print(f"\n{Colors.CYAN}🔍 Verifying installation...{Colors.RESET}")
        
        node_version = self.run_command('node --version', "Checking Node.js", capture=True)
        npm_version = self.run_command('npm --version', "Checking npm", capture=True)
        
        if node_version and npm_version:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✓ Node.js {node_version} installed{Colors.RESET}")
            print(f"{Colors.GREEN}{Colors.BOLD}✓ npm {npm_version} installed{Colors.RESET}")
            return True
        else:
            print(f"\n{Colors.RED}✗ Installation verification failed{Colors.RESET}")
            return False

    def install_global_packages(self):
        """Install global npm packages for TOBI"""
        print(f"\n{Colors.CYAN}📦 Installing global packages...{Colors.RESET}")
        
        packages = [
            'npm@latest',
            'pm2',
            'nodemon',
            'forever',
            'yarn',
            'pnpm'
        ]
        
        for package in packages:
            self.run_command(f'npm install -g {package}', f"Installing {package}")
        
        print(f"{Colors.GREEN}✓ Global packages installed{Colors.RESET}")

    def create_version_script(self):
        """Create version management script"""
        script_content = '''#!/bin/bash
# TOBI Node Version Switcher

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

show_versions() {
    echo "Available Node.js versions:"
    nvm list
}

switch_version() {
    if [ -z "$1" ]; then
        echo "Usage: tobi-node <version>"
        echo "Example: tobi-node 20.11.0"
    else
        nvm use $1
        echo "Switched to Node.js $1"
    fi
}

case "$1" in
    list) show_versions ;;
    use) switch_version "$2" ;;
    *) nvm current ;;
esac
'''
        
        script_path = os.path.join(self.home, '.local/bin/tobi-node')
        os.makedirs(os.path.dirname(script_path), exist_ok=True)
        with open(script_path, 'w') as f:
            f.write(script_content)
        os.chmod(script_path, 0o755)
        print(f"{Colors.GREEN}✓ Created version manager script{Colors.RESET}")

    def main(self):
        """Main installation routine"""
        self.print_banner()
        
        # Check current Node.js
        current_node = self.run_command('node --version', "Checking current Node.js", capture=True)
        if current_node:
            print(f"\n{Colors.GREEN}✓ Node.js already installed: {current_node}{Colors.RESET}")
            upgrade = input(f"\n{Colors.YELLOW}Upgrade to latest LTS? (y/n): {Colors.RESET}")
            if upgrade.lower() != 'y':
                print(f"{Colors.GREEN}Keeping existing Node.js installation{Colors.RESET}")
                return
        
        # Install based on platform
        success = False
        if self.is_termux:
            success = self.install_nvm_termux()
        elif self.system == 'Linux' or self.system == 'Darwin':
            # Try NVM first
            if self.run_command('git --version', "Checking git", capture=True):
                success = self.install_nvm_linux()
                if success:
                    # Install Node.js via NVM
                    self.run_command('source ~/.bashrc && nvm install --lts', "Installing Node.js LTS via NVM")
                    self.run_command('source ~/.bashrc && nvm use --lts', "Setting Node.js LTS as default")
            else:
                print(f"{Colors.YELLOW}⚠️ Git not found, installing directly...{Colors.RESET}")
                success = self.install_node_direct('lts')
        elif self.system == 'Windows':
            success = self.install_nvm_windows()
            if success:
                self.run_command('nvm install lts', "Installing Node.js LTS")
                self.run_command('nvm use lts', "Setting Node.js LTS as default")
        else:
            print(f"{Colors.RED}❌ Unsupported platform: {self.system}{Colors.RESET}")
            success = False
        
        if success or self.verify_installation():
            self.install_global_packages()
            self.create_version_script()
            
            # Final success message
            print(f"\n{Colors.GREEN}{Colors.BOLD}")
            print("╔════════════════════════════════════════════════════════════════╗")
            print("║           NODE.JS INSTALLATION COMPLETE!                       ║")
            print("╠════════════════════════════════════════════════════════════════╣")
            print("║                                                                ║")
            print("║  ✓ Node.js and npm successfully installed                     ║")
            print("║  ✓ Global packages installed                                  ║")
            print("║  ✓ Version manager created                                    ║")
            print("║                                                                ║")
            print("║  Commands:                                                     ║")
            print("║    node --version    - Check Node.js version                  ║")
            print("║    npm --version     - Check npm version                      ║")
            print("║    tobi-node list    - List available Node.js versions        ║")
            print("║    tobi-node use     - Switch Node.js version                 ║")
            print("║                                                                ║")
            print("╚════════════════════════════════════════════════════════════════╝")
            print(Colors.RESET)
            
            # Ask to start TOBI
            try:
                start = input(f"\n{Colors.CYAN}🚀 Start TOBI now? (y/n): {Colors.RESET}")
                if start.lower() == 'y':
                    os.system('node Tobi.js')
            except:
                pass
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ Installation failed. Please install Node.js manually.{Colors.RESET}")
            sys.exit(1)

if __name__ == "__main__":
    try:
        installer = NVMInstaller()
        installer.main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️ Installation cancelled by user{Colors.RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Colors.RED}❌ Error: {e}{Colors.RESET}")
        sys.exit(1)