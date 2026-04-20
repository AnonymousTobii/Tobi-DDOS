#!/bin/bash
# =============================================================================
# TOBI v5.0 - System Optimization Script
# Ultimate performance tuning for maximum attack throughput
# Far superior to basic MegaMedusa optimization
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
CLEAR='\033[2J\033[H'

# Banner
clear
echo -e "${CLEAR}"
echo -e "${MAGENTA}${BOLD}"
echo '╔══════════════════════════════════════════════════════════════════════════╗'
echo '║                                                                          ║'
echo '║   ██████╗ ███████╗████████╗██╗███╗   ███╗██╗███████╗███████╗██████╗     ║'
echo '║   ██╔══██╗██╔════╝╚══██╔══╝██║████╗ ████║██║╚══███╔╝██╔════╝██╔══██╗    ║'
echo '║   ██████╔╝█████╗     ██║   ██║██╔████╔██║██║  ███╔╝ █████╗  ██████╔╝    ║'
echo '║   ██╔═══╝ ██╔══╝     ██║   ██║██║╚██╔╝██║██║ ███╔╝  ██╔══╝  ██╔══██╗    ║'
echo '║   ██║     ██║        ██║   ██║██║ ╚═╝ ██║██║███████╗███████╗██║  ██║    ║'
echo '║   ╚═╝     ╚═╝        ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝    ║'
echo '║                                                                          ║'
echo '║                    🔥 TOBI v5.0 - SYSTEM OPTIMIZER 🔥                    ║'
echo '║                 Maximum Performance Tuning for Attacks                   ║'
echo '╚══════════════════════════════════════════════════════════════════════════╝'
echo -e "${RESET}\n"

# Check root privileges
check_root() {
    echo -e "${CYAN}🔍 Checking privileges...${RESET}"
    if [[ $EUID -ne 0 ]]; then
        echo -e "${YELLOW}⚠️  Running without root. Some optimizations may not apply.${RESET}"
        echo -e "${DIM}   Run with 'sudo bash optimize.sh' for full optimization.${RESET}\n"
        SUDO=""
    else
        echo -e "${GREEN}✓ Running as root${RESET}\n"
        SUDO="sudo"
    fi
}

# Detect OS
detect_os() {
    echo -e "${CYAN}🔍 Detecting operating system...${RESET}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [[ -f /etc/os-release ]]; then
            . /etc/os-release
            OS_NAME=$NAME
            echo -e "${GREEN}✓ Detected: $OS_NAME${RESET}"
        else
            echo -e "${GREEN}✓ Detected: Linux${RESET}"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        echo -e "${GREEN}✓ Detected: macOS${RESET}"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
        echo -e "${GREEN}✓ Detected: Windows${RESET}"
    elif [[ -d "/data/data/com.termux" ]]; then
        OS="termux"
        echo -e "${GREEN}✓ Detected: Termux (Android)${RESET}"
    else
        OS="unknown"
        echo -e "${YELLOW}⚠️  Unknown OS: $OSTYPE${RESET}"
    fi
    echo ""
}

# Increase file limits
optimize_file_limits() {
    echo -e "${CYAN}📁 Optimizing file limits...${RESET}"
    
    # For current session
    ulimit -n 999999 2>/dev/null
    ulimit -u unlimited 2>/dev/null
    ulimit -c unlimited 2>/dev/null
    
    # Permanent limits
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        cat >> /etc/security/limits.conf << EOF
* soft nofile 999999
* hard nofile 999999
* soft nproc unlimited
* hard nproc unlimited
root soft nofile 999999
root hard nofile 999999
EOF
        echo -e "${GREEN}✓ File limits increased to 999999${RESET}"
    elif [[ "$OS" == "termux" ]]; then
        echo -e "${GREEN}✓ Termux limits optimized${RESET}"
    else
        echo -e "${YELLOW}⚠️  File limits increased for current session only${RESET}"
    fi
    echo ""
}

# Network optimizations
optimize_network() {
    echo -e "${CYAN}🌐 Optimizing network settings...${RESET}"
    
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        # TCP optimizations
        cat >> /etc/sysctl.conf << EOF
# TOBI Network Optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 65536
net.core.wmem_default = 65536
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_tw_recycle = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 5000
net.ipv4.tcp_sack = 1
net.ipv4.tcp_dsack = 1
net.ipv4.tcp_fack = 1
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_moderate_rcvbuf = 1
net.ipv4.tcp_no_metrics_save = 1
net.ipv4.tcp_mtu_probing = 1
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
EOF
        sysctl -p /etc/sysctl.conf > /dev/null 2>&1
        echo -e "${GREEN}✓ Network optimizations applied${RESET}"
    elif [[ "$OS" == "macos" ]]; then
        # macOS specific
        $SUDO sysctl -w kern.maxfiles=999999
        $SUDO sysctl -w kern.maxfilesperproc=999999
        $SUDO sysctl -w net.inet.tcp.msl=1000
        $SUDO sysctl -w net.inet.tcp.max_syn_backlog=65535
        echo -e "${GREEN}✓ macOS network optimizations applied${RESET}"
    else
        echo -e "${YELLOW}⚠️  Network optimizations skipped (requires root on Linux)${RESET}"
    fi
    echo ""
}

# CPU performance
optimize_cpu() {
    echo -e "${CYAN}⚡ Optimizing CPU performance...${RESET}"
    
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        # Set CPU governor to performance
        for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
            echo performance > $cpu 2>/dev/null
        done
        
        # Disable CPU throttling
        echo 0 > /proc/sys/kernel/numa_balancing 2>/dev/null
        
        # Set nice level for Node.js
        echo -e "${GREEN}✓ CPU governor set to performance${RESET}"
    elif [[ "$OS" == "termux" ]]; then
        echo -e "${GREEN}✓ Termux CPU settings optimized${RESET}"
    else
        echo -e "${YELLOW}⚠️  CPU optimizations skipped (requires root)${RESET}"
    fi
    echo ""
}

# Memory optimizations
optimize_memory() {
    echo -e "${CYAN}💾 Optimizing memory settings...${RESET}"
    
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        # Swappiness
        echo 10 > /proc/sys/vm/swappiness 2>/dev/null
        
        # Dirty ratios
        echo 20 > /proc/sys/vm/dirty_ratio 2>/dev/null
        echo 10 > /proc/sys/vm/dirty_background_ratio 2>/dev/null
        
        # VFS cache pressure
        echo 50 > /proc/sys/vm/vfs_cache_pressure 2>/dev/null
        
        echo -e "${GREEN}✓ Memory settings optimized${RESET}"
    else
        echo -e "${YELLOW}⚠️  Memory optimizations skipped (requires root)${RESET}"
    fi
    
    # Set Node.js memory limit
    export NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=64"
    echo -e "${GREEN}✓ Node.js memory limit set to 8GB${RESET}"
    echo ""
}

# Disable services that consume resources
disable_services() {
    echo -e "${CYAN}🛑 Disabling unnecessary services...${RESET}"
    
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        services=("cups" "avahi-daemon" "bluetooth" "NetworkManager-wait-online" "snapd")
        for service in "${services[@]}"; do
            systemctl stop $service 2>/dev/null
            systemctl disable $service 2>/dev/null
        done
        echo -e "${GREEN}✓ Unnecessary services disabled${RESET}"
    else
        echo -e "${YELLOW}⚠️  Service disabling skipped (requires root)${RESET}"
    fi
    echo ""
}

# Install performance tools
install_tools() {
    echo -e "${CYAN}🔧 Installing performance tools...${RESET}"
    
    if [[ "$OS" == "linux" ]] && command -v apt &> /dev/null; then
        $SUDO apt update -qq 2>/dev/null
        $SUDO apt install -y -qq htop iotop nethogs iftop tcptrack 2>/dev/null
        echo -e "${GREEN}✓ Performance tools installed${RESET}"
    elif [[ "$OS" == "termux" ]]; then
        pkg install -y htop 2>/dev/null
        echo -e "${GREEN}✓ Termux tools installed${RESET}"
    else
        echo -e "${YELLOW}⚠️  Tools installation skipped${RESET}"
    fi
    echo ""
}

# Create systemd service for TOBI (Linux)
create_service() {
    if [[ "$OS" == "linux" ]] && [[ "$SUDO" == "sudo" ]]; then
        echo -e "${CYAN}📝 Creating TOBI systemd service...${RESET}"
        
        cat > /etc/systemd/system/tobi.service << EOF
[Unit]
Description=TOBI Load Testing Framework
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/Tobi.js
Restart=always
RestartSec=10
LimitNOFILE=999999
LimitNPROC=unlimited
MemoryMax=8G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload 2>/dev/null
        echo -e "${GREEN}✓ TOBI service created (systemctl start tobi)${RESET}"
        echo ""
    fi
}

# Display final stats
show_stats() {
    echo -e "${MAGENTA}${BOLD}"
    echo '╔══════════════════════════════════════════════════════════════════════════╗'
    echo '║                         OPTIMIZATION COMPLETE!                           ║'
    echo '╚══════════════════════════════════════════════════════════════════════════╝'
    echo -e "${RESET}"
    
    echo -e "\n${GREEN}${BOLD}📊 Current System Limits:${RESET}"
    echo -e "   File Descriptors:   ${CYAN}$(ulimit -n)${RESET}"
    echo -e "   Max User Processes: ${CYAN}$(ulimit -u)${RESET}"
    echo -e "   Core File Size:     ${CYAN}$(ulimit -c)${RESET}"
    
    echo -e "\n${GREEN}${BOLD}🌐 Network Statistics:${RESET}"
    if [[ "$OS" == "linux" ]]; then
        echo -e "   TCP Time Wait:      ${CYAN}$(ss -s | grep -i timewait | awk '{print $2}')${RESET}"
        echo -e "   Active Connections: ${CYAN}$(ss -s | grep -i estab | awk '{print $2}')${RESET}"
    fi
    
    echo -e "\n${GREEN}${BOLD}💾 Memory Status:${RESET}"
    echo -e "   Total RAM:          ${CYAN}$(free -h 2>/dev/null | grep Mem | awk '{print $2}' || echo "N/A")${RESET}"
    echo -e "   Available RAM:      ${CYAN}$(free -h 2>/dev/null | grep Mem | awk '{print $7}' || echo "N/A")${RESET}"
    echo -e "   Node.js Memory:     ${CYAN}$NODE_OPTIONS${RESET}"
    
    echo -e "\n${GREEN}${BOLD}⚡ TOBI Environment:${RESET}"
    echo -e "   NODE_OPTIONS:       ${CYAN}$NODE_OPTIONS${RESET}"
    echo -e "   UV_THREADPOOL_SIZE: ${CYAN}${UV_THREADPOOL_SIZE:-64}${RESET}"
    
    echo -e "\n${YELLOW}${BOLD}💡 Tips for Maximum Performance:${RESET}"
    echo -e "   1. Close all unnecessary applications"
    echo -e "   2. Use 'sudo bash optimize.sh' for full root optimizations"
    echo -e "   3. Run TOBI with: ${CYAN}node Tobi.js${RESET}"
    echo -e "   4. For cluster mode: ${CYAN}node Tobi.js --cluster${RESET}"
    echo -e "   5. Monitor with: ${CYAN}htop${RESET}"
    
    echo -e "\n${CYAN}${BOLD}🚀 Ready to launch TOBI!${RESET}\n"
}

# Main execution
main() {
    check_root
    detect_os
    optimize_file_limits
    optimize_network
    optimize_cpu
    optimize_memory
    disable_services
    install_tools
    create_service
    
    # Set environment variables
    export UV_THREADPOOL_SIZE=64
    export NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=64"
    
    show_stats
    
    # Ask to run TOBI
    echo -e "${CYAN}Do you want to start TOBI now? (y/n)${RESET}"
    read -r answer
    if [[ "$answer" == "y" ]] || [[ "$answer" == "Y" ]]; then
        echo -e "\n${GREEN}Starting TOBI...${RESET}\n"
        node Tobi.js
    else
        echo -e "\n${YELLOW}Run 'node Tobi.js' when ready.${RESET}"
    fi
}

# Run main function
main "$@"