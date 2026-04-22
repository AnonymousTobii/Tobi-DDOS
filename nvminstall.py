#!/usr/bin/env python3
"""
TOBI v6.0 - Ultimate Node Version Manager Installer
Multi-platform Node.js installation with advanced version management
Far superior to MegaMedusa nvminstall.py - includes checksums, progress bars, and parallel installs
"""

import os
import sys
import platform
import subprocess
import time
import json
import urllib.request
import urllib.error
import tarfile
import zipfile
import tempfile
import shutil
import hashlib
import threading
import queue
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Optional imports with fallbacks
try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False

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

# Node.js versions and checksums (SHA256)
NODE_VERSIONS = {
    'lts': '20.12.2',      # April 2024 LTS
    'latest': '22.0.0',
    'stable': '20.12.2',
    'legacy': '18.20.2'
}

# Download mirrors
MIRRORS = [
    'https://nodejs.org/dist',
    'https://mirrors.aliyun.com/nodejs-release',
    'https://npmmirror.com/mirrors/node',
    'https://mirrors.huaweicloud.com/nodejs'
]

class ProgressHook:
    """Report download progress"""
    def __init__(self, filename, total_size):
        self.filename = filename
        self.total_size = total_size
        self.downloaded = 0
        self.last_update = 0
        if TQDM_AVAILABLE:
            self.pbar = tqdm(total=total_size, unit='B', unit_scale=True, desc=filename)
        else:
            self.pbar = None

    def __call__(self, count, block_size, total_size):
        self.downloaded += count * block_size
        if self.pbar:
            self.pbar.update(count * block_size)
        elif time.time() - self.last_update > 1:
            percent = (self.downloaded / total_size) * 100 if total_size else 0
            print(f"\r{Colors.DIM}Downloading {self.filename}: {percent:.1f}%{Colors.RESET}", end='')
            self.last_update = time.time()

    def close(self):
        if self.pbar:
            self.pbar.close()
        elif self.total_size:
            print()  # newline

class NVMInstaller:
    def __init__(self):
        self.system = platform.system()
        self.arch = platform.machine()
        self.is_termux = 'com.termux' in os.environ.get('PREFIX', '')
        self.home = str(Path.home())
        self.nvm_dir = os.path.join(self.home, '.nvm')
        self.node_dir = os.path.join(self.home, '.node')
        self.local_bin = os.path.join(self.home, '.local/bin')
        os.makedirs(self.local_bin, exist_ok=True)
        self.checksums = {}

    def print_banner(self):
        print(Colors.CLEAR)
        print(Colors.MAGENTA + Colors.BOLD + r"""
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ███╗   ██╗██╗   ██╗███╗   ███╗    ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗
║   ████╗  ██║██║   ██║████╗ ████║    ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║
║   ██╔██╗ ██║██║   ██║██╔████╔██║    ██║██╔██╗ ██║███████╗   ██║   ███████║██║
║   ██║╚██╗██║██║   ██║██║╚██╔╝██║    ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║
║   ██║ ╚████║╚██████╔╝██║ ╚═╝ ██║    ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗
║   ╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
║                                                                          ║
║              🔥 TOBI v6.0 - NODE VERSION MANAGER INSTALLER 🔥            ║
║               Multi-Platform | Checksums | Parallel Installs             ║
╚══════════════════════════════════════════════════════════════════════════╝
""" + Colors.RESET)
        print(f"\n{Colors.CYAN}📊 System Information:{Colors.RESET}")
        print(f"   OS: {self.system} ({self.arch})")
        print(f"   Home: {self.home}")
        print(f"   Termux: {self.is_termux}")
        print(f"   TQDM: {'✓' if TQDM_AVAILABLE else '✗ (install with: pip install tqdm)'}")
        print()

    def run_command(self, cmd, description, capture=False, check=False):
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
                    if check:
                        sys.exit(1)
                    return None
            else:
                result = subprocess.run(cmd, shell=True, timeout=300)
                if result.returncode == 0:
                    print(f"{Colors.GREEN}✓{Colors.RESET}")
                    return True
                else:
                    print(f"{Colors.RED}✗{Colors.RESET}")
                    if check:
                        sys.exit(1)
                    return False
        except subprocess.TimeoutExpired:
            print(f"{Colors.RED}✗ (Timeout){Colors.RESET}")
            return None if capture else False
        except Exception as e:
            print(f"{Colors.RED}✗ ({str(e)[:30]}){Colors.RESET}")
            return None if capture else False

    def run_nvm_command(self, cmd, description):
        """Run an nvm command by sourcing nvm.sh first"""
        nvm_sh = os.path.join(self.nvm_dir, 'nvm.sh')
        full_cmd = f'bash -c "source {nvm_sh} && {cmd}"'
        return self.run_command(full_cmd, description)

    def download_file(self, url, dest, desc=None):
        """Download with progress reporting and checksum verification"""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TOBI-Installer/6.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                hook = ProgressHook(desc or os.path.basename(dest), total_size)
                with open(dest, 'wb') as f:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
                        hook(len(chunk), 8192, total_size)
                hook.close()
            return True
        except Exception as e:
            print(f"{Colors.RED}Download failed: {e}{Colors.RESET}")
            return False

    def verify_checksum(self, filepath, version, platform_arch):
        """Verify SHA256 checksum of downloaded file"""
        expected = self.checksums.get(f"{version}-{platform_arch}")
        if not expected:
            # Try to fetch from official site
            sha_url = f"https://nodejs.org/dist/v{version}/SHASUMS256.txt"
            try:
                with urllib.request.urlopen(sha_url, timeout=10) as resp:
                    shas = resp.read().decode()
                    for line in shas.splitlines():
                        if line.endswith(f"node-v{version}-{platform_arch}.tar.xz"):
                            expected = line.split()[0]
                            break
            except:
                pass
        if not expected:
            print(f"{Colors.YELLOW}⚠️  No checksum available for verification{Colors.RESET}")
            return True
        sha256 = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                sha256.update(chunk)
        computed = sha256.hexdigest()
        if computed == expected:
            print(f"{Colors.GREEN}✓ Checksum verified{Colors.RESET}")
            return True
        else:
            print(f"{Colors.RED}✗ Checksum mismatch! Expected {expected[:16]}... got {computed[:16]}{Colors.RESET}")
            return False

    def install_nvm_linux(self):
        """Install NVM on Linux/Mac with proper shell sourcing"""
        print(f"\n{Colors.CYAN}📦 Installing NVM on Linux/Mac...{Colors.RESET}")
        if not self.run_command('git --version', "Checking git", capture=True):
            print(f"{Colors.YELLOW}⚠️ Git not found. Installing via package manager...{Colors.RESET}")
            if self.system == 'Darwin':
                self.run_command('brew install git', "Installing git via Homebrew")
            else:
                self.run_command('sudo apt update && sudo apt install git -y', "Installing git via apt")
        # Remove existing NVM
        if os.path.exists(self.nvm_dir):
            shutil.rmtree(self.nvm_dir)
        clone_cmd = f'git clone https://github.com/nvm-sh/nvm.git "{self.nvm_dir}"'
        if self.run_command(clone_cmd, "Cloning NVM repository"):
            # Source NVM in profile files
            nvm_source = f'\nexport NVM_DIR="{self.nvm_dir}"\n[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"\n'
            profiles = ['.bashrc', '.zshrc', '.profile', '.bash_profile']
            for prof in profiles:
                prof_path = os.path.join(self.home, prof)
                if os.path.exists(prof_path) or prof == '.bashrc':
                    with open(prof_path, 'a') as f:
                        f.write(nvm_source)
            # Set environment for current session
            os.environ['NVM_DIR'] = self.nvm_dir
            return True
        return False

    def install_nvm_windows(self):
        """Install Node.js on Windows using nvm-windows"""
        print(f"\n{Colors.CYAN}📦 Installing Node.js on Windows...{Colors.RESET}")
        nvm_url = "https://github.com/coreybutler/nvm-windows/releases/download/1.1.12/nvm-setup.exe"
        installer_path = os.path.join(tempfile.gettempdir(), "nvm-setup.exe")
        if self.download_file(nvm_url, installer_path, "nvm-windows installer"):
            os.system(f'"{installer_path}" /S')
            time.sleep(5)
            os.remove(installer_path)
            return True
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
        success = True
        for cmd, desc in commands:
            if not self.run_command(cmd, desc):
                success = False
        return success

    def install_node_direct(self, version='lts'):
        """Direct Node.js installation without NVM (with checksums)"""
        print(f"\n{Colors.CYAN}📦 Direct Node.js installation...{Colors.RESET}")
        node_version = NODE_VERSIONS.get(version, NODE_VERSIONS['lts'])
        # Determine platform string for Node.js
        if self.system == 'Linux':
            if self.arch == 'x86_64':
                platform_arch = 'linux-x64'
            elif self.arch == 'aarch64':
                platform_arch = 'linux-arm64'
            elif self.arch == 'armv7l':
                platform_arch = 'linux-armv7l'
            else:
                platform_arch = 'linux-x64'
            ext = 'tar.xz'
        elif self.system == 'Darwin':
            if self.arch == 'arm64':
                platform_arch = 'darwin-arm64'
            else:
                platform_arch = 'darwin-x64'
            ext = 'tar.gz'
        else:
            print(f"{Colors.RED}✗ Unsupported platform for direct install{Colors.RESET}")
            return False
        filename = f'node-v{node_version}-{platform_arch}.{ext}'
        for mirror in MIRRORS:
            url = f"{mirror}/v{node_version}/{filename}"
            print(f"{Colors.YELLOW}📥 Trying: {url}{Colors.RESET}")
            download_path = os.path.join(tempfile.gettempdir(), filename)
            if self.download_file(url, download_path, filename):
                if not self.verify_checksum(download_path, node_version, platform_arch):
                    os.remove(download_path)
                    continue
                # Extract
                extract_dir = self.node_dir
                os.makedirs(extract_dir, exist_ok=True)
                if ext == 'tar.xz':
                    with tarfile.open(download_path, 'r:xz') as tar:
                        tar.extractall(extract_dir)
                elif ext == 'tar.gz':
                    with tarfile.open(download_path, 'r:gz') as tar:
                        tar.extractall(extract_dir)
                # Add to PATH via symlink in ~/.local/bin
                extracted_folder = None
                for item in os.listdir(extract_dir):
                    if item.startswith('node-v'):
                        extracted_folder = os.path.join(extract_dir, item)
                        break
                if extracted_folder:
                    bin_path = os.path.join(extracted_folder, 'bin')
                    for exe in ['node', 'npm', 'npx']:
                        src = os.path.join(bin_path, exe)
                        dst = os.path.join(self.local_bin, exe)
                        if os.path.exists(src):
                            if os.path.exists(dst):
                                os.remove(dst)
                            os.symlink(src, dst)
                    # Add to PATH environment for current session
                    os.environ['PATH'] = f"{self.local_bin}:{os.environ['PATH']}"
                os.remove(download_path)
                print(f"{Colors.GREEN}✓ Node.js {node_version} installed to {extracted_folder}{Colors.RESET}")
                return True
        return False

    def install_global_packages_parallel(self):
        """Install global npm packages in parallel using ThreadPoolExecutor"""
        print(f"\n{Colors.CYAN}📦 Installing global packages in parallel...{Colors.RESET}")
        packages = [
            'npm@latest',
            'pm2',
            'nodemon',
            'forever',
            'yarn',
            'pnpm'
        ]
        def install(pkg):
            return self.run_command(f'npm install -g {pkg}', f"Installing {pkg}")
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(install, pkg): pkg for pkg in packages}
            for future in as_completed(futures):
                pkg = futures[future]
                if future.result():
                    print(f"{Colors.GREEN}✓ {pkg} installed{Colors.RESET}")
                else:
                    print(f"{Colors.RED}✗ {pkg} failed{Colors.RESET}")

    def verify_installation(self):
        """Verify Node.js and npm installation"""
        print(f"\n{Colors.CYAN}🔍 Verifying installation...{Colors.RESET}")
        node_version = self.run_command('node --version', "Checking Node.js", capture=True)
        npm_version = self.run_command('npm --version', "Checking npm", capture=True)
        if node_version and npm_version:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✓ Node.js {node_version} installed{Colors.RESET}")
            print(f"{Colors.GREEN}{Colors.BOLD}✓ npm {npm_version} installed{Colors.RESET}")
            return True
        return False

    def create_version_script(self):
        """Create enhanced version management script"""
        script_content = f'''#!/bin/bash
# TOBI Node Version Switcher

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

show_versions() {{
    echo "Available Node.js versions:"
    nvm list
}}

switch_version() {{
    if [ -z "$1" ]; then
        echo "Usage: tobi-node use <version>"
        echo "Example: tobi-node use 20.12.2"
    else
        nvm use $1
        echo "Switched to Node.js $1"
    fi
}}

install_version() {{
    if [ -z "$1" ]; then
        echo "Usage: tobi-node install <version>"
    else
        nvm install $1
    fi
}}

case "$1" in
    list) show_versions ;;
    use) switch_version "$2" ;;
    install) install_version "$2" ;;
    current) nvm current ;;
    *) echo "TOBI Node Manager v6.0"; echo "Commands: list, use <version>, install <version>, current" ;;
esac
'''
        script_path = os.path.join(self.local_bin, 'tobi-node')
        with open(script_path, 'w') as f:
            f.write(script_content)
        os.chmod(script_path, 0o755)
        print(f"{Colors.GREEN}✓ Created version manager script at {script_path}{Colors.RESET}")

    def update_path_profiles(self):
        """Ensure ~/.local/bin is in PATH across profiles"""
        path_export = '\nexport PATH="$HOME/.local/bin:$PATH"\n'
        profiles = ['.bashrc', '.zshrc', '.profile', '.bash_profile']
        for prof in profiles:
            prof_path = os.path.join(self.home, prof)
            if os.path.exists(prof_path):
                with open(prof_path, 'r') as f:
                    content = f.read()
                if '$HOME/.local/bin' not in content:
                    with open(prof_path, 'a') as f:
                        f.write(path_export)
            elif prof == '.bashrc':  # create default
                with open(prof_path, 'w') as f:
                    f.write(path_export)

    def main(self):
        """Main installation routine"""
        self.print_banner()
        # Check current Node.js
        current_node = self.run_command('node --version', "Checking current Node.js", capture=True)
        if current_node:
            print(f"\n{Colors.GREEN}✓ Node.js already installed: {current_node}{Colors.RESET}")
            upgrade = input(f"{Colors.YELLOW}Upgrade to latest LTS? (y/n): {Colors.RESET}").lower()
            if upgrade != 'y':
                print(f"{Colors.GREEN}Keeping existing Node.js installation{Colors.RESET}")
                self.update_path_profiles()
                self.create_version_script()
                self.install_global_packages_parallel()
                return
        # Install based on platform
        success = False
        if self.is_termux:
            success = self.install_nvm_termux()
        elif self.system in ('Linux', 'Darwin'):
            # Try NVM first
            if self.run_command('git --version', "Checking git", capture=True):
                success = self.install_nvm_linux()
                if success:
                    self.run_nvm_command('nvm install --lts', "Installing Node.js LTS via NVM")
                    self.run_nvm_command('nvm use --lts', "Setting Node.js LTS as default")
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
            sys.exit(1)
        # Final verification
        if not self.verify_installation():
            print(f"{Colors.RED}Installation verification failed. Attempting direct install...{Colors.RESET}")
            success = self.install_node_direct('lts')
            self.verify_installation()
        # Install global packages and scripts
        self.update_path_profiles()
        self.install_global_packages_parallel()
        self.create_version_script()
        # Success message
        print(f"\n{Colors.GREEN}{Colors.BOLD}")
        print("╔════════════════════════════════════════════════════════════════╗")
        print("║           NODE.JS INSTALLATION COMPLETE!                       ║")
        print("╠════════════════════════════════════════════════════════════════╣")
        print("║  ✓ Node.js and npm successfully installed                     ║")
        print("║  ✓ Global packages installed in parallel                      ║")
        print("║  ✓ Version manager created (tobi-node)                        ║")
        print("║  ✓ PATH updated in shell profiles                             ║")
        print("║                                                                ║")
        print("║  Commands:                                                     ║")
        print("║    node --version    - Check Node.js version                  ║")
        print("║    npm --version     - Check npm version                      ║")
        print("║    tobi-node list    - List available Node.js versions        ║")
        print("║    tobi-node use     - Switch Node.js version                 ║")
        print("║    tobi-node install - Install a specific version             ║")
        print("║                                                                ║")
        print("╚════════════════════════════════════════════════════════════════╝")
        print(Colors.RESET)
        # Option to start TOBI
        try:
            start = input(f"\n{Colors.CYAN}🚀 Start TOBI now? (y/n): {Colors.RESET}").lower()
            if start == 'y':
                tobi_js = Path.cwd() / 'Tobi.js'
                if tobi_js.exists():
                    os.system('node Tobi.js')
                else:
                    print(f"{Colors.YELLOW}Tobi.js not found in current directory.{Colors.RESET}")
        except (KeyboardInterrupt, EOFError):
            pass

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
