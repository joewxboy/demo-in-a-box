#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR=$(ls -dt "$SCRIPT_DIR"/box-build-temp-* 2>/dev/null | head -1)

if [ -z "$BUILD_DIR" ]; then
    echo "No active build found."
    echo ""
    echo "Start a build with:"
    echo "  make rebuild-boxes"
    exit 0
fi

BUILD_NAME=$(basename "$BUILD_DIR")
START_FILE="$BUILD_DIR/.build_start"

if [ ! -f "$START_FILE" ]; then
    date +%s > "$START_FILE"
fi

START_TIME=$(cat "$START_FILE")

clear

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Vagrant Box Build Monitor                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

show_elapsed() {
    local elapsed=$(($(date +%s) - START_TIME))
    printf "⏱  Elapsed: %02d:%02d" $((elapsed / 60)) $((elapsed % 60))
}

get_vm_status() {
    cd "$BUILD_DIR" 2>/dev/null || return 1
    vagrant status 2>/dev/null | grep "default" | awk '{print $2}'
}

get_build_stage() {
    local log_file=$(ls -t "$SCRIPT_DIR"/vagrant-build-*.log 2>/dev/null | head -1)
    if [ -n "$log_file" ] && [ -f "$log_file" ]; then
        if grep -q "Packaging box" "$log_file" 2>/dev/null; then
            echo "4/4 Packaging"
        elif grep -q "Zeroing out free space" "$log_file" 2>/dev/null; then
            echo "3/4 Compressing"
        elif grep -q "Running provisioner" "$log_file" 2>/dev/null; then
            echo "2/4 Provisioning"
        elif grep -q "Booting VM" "$log_file" 2>/dev/null; then
            echo "1/4 Starting VM"
        else
            echo "0/4 Initializing"
        fi
    else
        cd "$BUILD_DIR" 2>/dev/null || return 1
        if vagrant ssh -c "test -f /var/lib/dpkg/lock-frontend || test -f /var/lib/rpm/.rpm.lock" 2>/dev/null; then
            echo "2/4 Provisioning"
        elif [ "$(get_vm_status)" = "running" ]; then
            echo "1/4 Starting VM"
        else
            echo "0/4 Initializing"
        fi
    fi
}

get_package_progress() {
    cd "$BUILD_DIR" 2>/dev/null || return 1
    vagrant ssh -c "ps aux 2>/dev/null | grep -E 'apt-get|dnf|yum' | grep -v grep | wc -l" 2>/dev/null || echo "0"
}

get_vm_memory() {
    cd "$BUILD_DIR" 2>/dev/null || return 1
    local vm_name=$(VBoxManage list runningvms 2>/dev/null | grep "$BUILD_NAME" | cut -d'"' -f2)
    if [ -n "$vm_name" ]; then
        VBoxManage showvminfo "$vm_name" --machinereadable 2>/dev/null | grep "^memory=" | cut -d'=' -f2
    else
        echo "N/A"
    fi
}

get_recent_activity() {
    local log_file=$(ls -t "$SCRIPT_DIR"/vagrant-build-*.log 2>/dev/null | head -1)
    if [ -f "$log_file" ]; then
        tail -3 "$log_file" | grep -v "^$" | head -1
    else
        cd "$BUILD_DIR" 2>/dev/null || return 1
        vagrant ssh -c "tail -1 /var/log/syslog 2>/dev/null | cut -d' ' -f5-" 2>/dev/null || echo "Waiting for VM..."
    fi
}

while true; do
    clear
    
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Vagrant Box Build Monitor                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    ELAPSED=$(($(date +%s) - START_TIME))
    VM_STATUS=$(get_vm_status)
    STAGE=$(get_build_stage)
    PKG_COUNT=$(get_package_progress)
    VM_MEM=$(get_vm_memory)
    
    printf "Build Directory: %s\n" "$(basename "$BUILD_DIR")"
    printf "⏱  Elapsed Time:  %02d:%02d (mm:ss)\n" $((ELAPSED / 60)) $((ELAPSED % 60))
    printf "📦 Stage:         %s\n" "$STAGE"
    printf "🖥  VM Status:     %s\n" "${VM_STATUS:-unknown}"
    printf "💾 VM Memory:     %s MB\n" "${VM_MEM}"
    
    if [ "$PKG_COUNT" -gt 0 ]; then
        printf "📥 Package Mgr:   Running (%s processes)\n" "$PKG_COUNT"
    else
        printf "📥 Package Mgr:   Idle\n"
    fi
    
    echo ""
    echo "Recent Activity:"
    echo "────────────────────────────────────────────────────────────"
    
    RECENT=$(get_recent_activity)
    if [ ${#RECENT} -gt 60 ]; then
        echo "${RECENT:0:57}..."
    else
        echo "$RECENT"
    fi
    
    echo ""
    echo "────────────────────────────────────────────────────────────"
    
    case "$STAGE" in
        "1/4"*)
            echo "⏳ Current: Downloading base box and starting VM..."
            echo "⏭  Next:    Installing packages (~5-10 min)"
            ;;
        "2/4"*)
            echo "⏳ Current: Installing packages and dependencies..."
            echo "⏭  Next:    Compressing disk (~2-3 min)"
            ;;
        "3/4"*)
            echo "⏳ Current: Compressing disk for smaller box size..."
            echo "⏭  Next:    Packaging box file"
            ;;
        "4/4"*)
            echo "⏳ Current: Creating final .box file..."
            echo "⏭  Next:    Cleanup and completion"
            ;;
        *)
            echo "⏳ Initializing build environment..."
            ;;
    esac
    
    echo ""
    printf "Refresh in 3s... (Ctrl+C to exit monitor)\n"
    
    sleep 3
    
    if [ ! -d "$BUILD_DIR" ]; then
        clear
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║         Build Complete or Stopped                          ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo ""
        echo "Build directory no longer exists."
        echo "Check for .box files in:"
        echo "  $SCRIPT_DIR"
        echo ""
        ls -lh "$SCRIPT_DIR"/*.box 2>/dev/null || echo "No .box files found yet."
        break
    fi
done
