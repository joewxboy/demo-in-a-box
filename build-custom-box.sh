#!/bin/bash
set -e

# Build custom Vagrant box using Vagrant (not Packer)
# This is more reliable than Packer's vagrant builder

if [ $# -lt 2 ]; then
    echo "Usage: $0 <os-type> <box-version>"
    echo "Example: $0 ubuntu-24 1.0.0"
    exit 1
fi

OS_TYPE=$1
BOX_VERSION=$2
START_TIME=$(date +%s)

# Progress helper function
show_progress() {
    local message=$1
    local elapsed=$(($(date +%s) - START_TIME))
    printf "\n[%02d:%02d] %s\n" $((elapsed / 60)) $((elapsed % 60)) "$message"
}

# Spinner for long operations
show_spinner() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${spin:$i:1} %s" "$message"
        sleep 0.1
    done
    printf "\r✓ %s\n" "$message"
}

# Determine box details based on OS type
case $OS_TYPE in
    ubuntu-22)
        BASE_BOX="ubuntu/jammy64"
        BOX_NAME="demo-in-a-box/ubuntu-jammy-horizon"
        BOX_FILE="ubuntu-jammy-horizon-virtualbox-${BOX_VERSION}.box"
        PROVISION_SCRIPT="packer/scripts/provision-ubuntu-22.sh"
        ;;
    ubuntu-24)
        BASE_BOX="bento/ubuntu-24.04"
        BOX_NAME="demo-in-a-box/ubuntu-noble-horizon"
        BOX_FILE="ubuntu-noble-horizon-virtualbox-${BOX_VERSION}.box"
        PROVISION_SCRIPT="packer/scripts/provision-ubuntu-24.sh"
        ;;
    fedora-41)
        BASE_BOX="bento/fedora-41"
        BOX_NAME="demo-in-a-box/fedora-41-horizon"
        BOX_FILE="fedora-41-horizon-virtualbox-${BOX_VERSION}.box"
        PROVISION_SCRIPT="packer/scripts/provision-fedora-41.sh"
        ;;
    *)
        echo "Unknown OS type: $OS_TYPE"
        echo "Valid options: ubuntu-22, ubuntu-24, fedora-41"
        exit 1
        ;;
esac

echo "========================================="
echo "Building custom box: $BOX_NAME"
echo "Base box: $BASE_BOX"
echo "Version: $BOX_VERSION"
echo "Estimated time: 10-15 minutes"
echo "========================================="

# Get absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVISION_SCRIPT_FULL="$SCRIPT_DIR/$PROVISION_SCRIPT"
CLEANUP_SCRIPT_FULL="$SCRIPT_DIR/packer/scripts/common-cleanup.sh"

# Verify provision script exists
if [ ! -f "$PROVISION_SCRIPT_FULL" ]; then
    echo "ERROR: Provision script not found: $PROVISION_SCRIPT_FULL"
    exit 1
fi

if [ ! -f "$CLEANUP_SCRIPT_FULL" ]; then
    echo "ERROR: Cleanup script not found: $CLEANUP_SCRIPT_FULL"
    exit 1
fi

# Create temporary directory for build
BUILD_DIR="$SCRIPT_DIR/box-build-temp-$$"
mkdir -p "$BUILD_DIR" || { echo "ERROR: Failed to create build directory"; exit 1; }

# Create timestamp file for monitor
echo "$START_TIME" > "$BUILD_DIR/.build_start"

# Create a temporary Vagrantfile
cat > "$BUILD_DIR/Vagrantfile" <<EOF
Vagrant.configure("2") do |config|
  config.vm.box = "$BASE_BOX"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
  end
  
  config.vm.provision "shell", path: "$PROVISION_SCRIPT_FULL"
  config.vm.provision "shell", path: "$CLEANUP_SCRIPT_FULL"
end
EOF

# Verify Vagrantfile was created
if [ ! -f "$BUILD_DIR/Vagrantfile" ]; then
    echo "ERROR: Failed to create Vagrantfile"
    exit 1
fi

# Verify Vagrantfile exists in build directory
if [ ! -f "$BUILD_DIR/Vagrantfile" ]; then
    echo "ERROR: Vagrantfile not found in $BUILD_DIR"
    ls -la "$BUILD_DIR"
    exit 1
fi

show_progress "Stage 1/4: Starting VM and provisioning (this takes ~8-12 min)..."
show_progress "  → Importing base box, booting VM, establishing SSH..."
echo ""

# Unset any vagrant environment variables that might interfere
unset VAGRANT_CWD
unset VAGRANT_DOTFILE_PATH

# Run vagrant up directly in the build directory
cd "$BUILD_DIR" || {
    echo "ERROR: Cannot cd to $BUILD_DIR"
    exit 1
}

VAGRANT_VAGRANTFILE=Vagrantfile vagrant up || {
    VAGRANT_EXIT_CODE=$?
    echo ""
    show_progress "ERROR: vagrant up failed (exit code: $VAGRANT_EXIT_CODE)"
    VAGRANT_VAGRANTFILE=Vagrantfile vagrant destroy -f 2>/dev/null || true
    cd "$SCRIPT_DIR"
    rm -rf "$BUILD_DIR"
    exit 1
}

show_progress "  → VM provisioned successfully!"
echo ""

show_progress "Stage 2/4: Packaging box file..."
VAGRANT_VAGRANTFILE=Vagrantfile vagrant package --output "$SCRIPT_DIR/${BOX_FILE}" || {
    echo ""
    show_progress "ERROR: vagrant package failed"
    VAGRANT_VAGRANTFILE=Vagrantfile vagrant destroy -f 2>/dev/null || true
    cd "$SCRIPT_DIR"
    rm -rf "$BUILD_DIR"
    exit 1
}

echo ""
show_progress "Stage 3/4: Cleaning up temporary VM..."
VAGRANT_VAGRANTFILE=Vagrantfile vagrant destroy -f >/dev/null 2>&1
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

TOTAL_TIME=$(($(date +%s) - START_TIME))
echo ""

echo "========================================="
echo "✓ Custom box built successfully!"
echo "========================================="
printf "Box file:    %s\n" "$BOX_FILE"
printf "Box name:    %s\n" "$BOX_NAME"
printf "Total time:  %02d:%02d (mm:ss)\n" $((TOTAL_TIME / 60)) $((TOTAL_TIME % 60))
echo ""
echo "To add this box to Vagrant, run:"
echo "  vagrant box add --name ${BOX_NAME} ${BOX_FILE} --force"
echo ""
