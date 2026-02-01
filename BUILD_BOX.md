# Custom Vagrant Box Build Guide

This guide explains how to build custom Vagrant boxes with pre-installed dependencies for multiple operating systems.

## Prerequisites

### Install Packer

**macOS:**
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/packer
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install packer
```

**Verify Installation:**
```bash
packer version
```

## Supported Operating Systems

The system supports building custom boxes for:
- **ubuntu-22**: Ubuntu 22.04 LTS (Jammy Jellyfish) - Default
- **ubuntu-24**: Ubuntu 24.04 LTS (Noble Numbat)
- **fedora-41**: Fedora 41

## Build Process

### Option 1: Using Make (Recommended)

**Build default OS (Ubuntu 22):**
```bash
make rebuild-boxes
```

**Build specific OS:**
```bash
# Ubuntu 24
export HUB_OS_TYPE=ubuntu-24
export AGENT_OS_TYPE=ubuntu-24
make rebuild-boxes

# Fedora 41
export HUB_OS_TYPE=fedora-41
export AGENT_OS_TYPE=fedora-41
make rebuild-boxes

# Mixed OS (hub and agents different)
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=fedora-41
make rebuild-boxes
```

**Convenience shortcuts:**
```bash
make build-ubuntu-22  # Builds Ubuntu 22 for both hub and agents
make build-ubuntu-24  # Builds Ubuntu 24 for both hub and agents
make build-fedora-41  # Builds Fedora 41 for both hub and agents
```

This will:
1. Remove any existing custom boxes from Vagrant
2. Clean previous build artifacts
3. Build new box(es) with Packer
4. Add the new box(es) to Vagrant

### Option 2: Manual Steps

**For Ubuntu 22:**

```bash
# Step 1: Initialize Packer
packer init packer/ubuntu-22-horizon.pkr.hcl

# Step 2: Validate Template
packer validate packer/ubuntu-22-horizon.pkr.hcl

# Step 3: Build Box
packer build -var "box_version=1.0.0" packer/ubuntu-22-horizon.pkr.hcl

# Step 4: Add Box to Vagrant
vagrant box add --name demo-in-a-box/ubuntu-jammy-horizon ubuntu-jammy-horizon-virtualbox-1.0.0.box

# Step 5: Verify Box
vagrant box list | grep ubuntu-jammy-horizon
```

**For Ubuntu 24:**

```bash
packer init packer/ubuntu-24-horizon.pkr.hcl
packer build -var "box_version=1.0.0" packer/ubuntu-24-horizon.pkr.hcl
vagrant box add --name demo-in-a-box/ubuntu-noble-horizon ubuntu-noble-horizon-virtualbox-1.0.0.box
```

**For Fedora 41:**

```bash
packer init packer/fedora-41-horizon.pkr.hcl
packer build -var "box_version=1.0.0" packer/fedora-41-horizon.pkr.hcl
vagrant box add --name demo-in-a-box/fedora-41-horizon fedora-41-horizon-virtualbox-1.0.0.box
```

**Build Process:**
- Downloads base box (ubuntu/jammy64, bento/ubuntu-24.04, or bento/fedora-41)
- Updates system packages
- Installs Open Horizon dependencies (gcc, make, git, curl, jq, net-tools, docker)
- Cleans up package cache
- Compresses and creates box file

Build time: ~10-15 minutes per OS depending on network speed

## Versioning

The box version is controlled by the `BOX_VERSION` variable:

```bash
export BOX_VERSION=1.1.0
make rebuild-box
```

## What Gets Pre-installed

All custom boxes include:
- **Build Tools**: gcc, make, git
- **Utilities**: curl, jq, net-tools
- **Container Runtime**: Docker and Docker Compose

### Box-Specific Details

| Box | Base OS | Docker Package | Size | Script |
|-----|---------|----------------|------|--------|
| ubuntu-jammy-horizon | Ubuntu 22.04 LTS | docker.io, docker-compose-v2 | ~500-700MB | packer/scripts/provision-ubuntu-22.sh |
| ubuntu-noble-horizon | Ubuntu 24.04 LTS | docker.io, docker-compose-v2 | ~500-700MB | packer/scripts/provision-ubuntu-24.sh |
| fedora-41-horizon | Fedora 41 | docker-ce, docker-compose-plugin | ~800MB-1GB | packer/scripts/provision-fedora-41.sh |

## Benefits

Compared to base ubuntu/jammy64:
- ⏱️ **Time Savings**: 5-10 minutes per VM (no package installation)
- 📦 **Consistent**: All VMs use identical base configuration
- 🌐 **Network**: Reduces bandwidth usage during provisioning
- ✅ **Reliable**: Pre-tested package versions

## Updating Boxes

When dependencies need updating:

1. Modify appropriate provisioner script in `packer/scripts/`:
   - `provision-ubuntu-22.sh` for Ubuntu 22
   - `provision-ubuntu-24.sh` for Ubuntu 24
   - `provision-fedora-41.sh` for Fedora 41
2. Increment version: `export BOX_VERSION=1.1.0`
3. Rebuild: `make rebuild-boxes`
4. Test with unicycle: `make init`
5. Commit changes with version number in commit message

**Note:** All boxes share the same `BOX_VERSION` for consistency.

## Troubleshooting

### Build Fails with "Vagrant source not found"

Ensure you have Vagrant and VirtualBox installed:
```bash
vagrant version
vboxmanage --version
```

### Build Fails with "Connection timeout"

Network issue downloading base box. Retry:
```bash
make clean-box
make build-box
```

### Box Takes Too Long to Build

This is normal. Initial build includes:
- Downloading ~700MB base box
- System upgrade (~200MB)
- Package installation (~150MB)
- Compression

Subsequent builds are faster as base box is cached.

### Box Not Found After Building

Verify the box was added:
```bash
vagrant box list
```

If missing, manually add:
```bash
vagrant box add --name demo-in-a-box/ubuntu-jammy-horizon ubuntu-jammy-horizon-virtualbox-1.0.0.box
```

## Cleanup

### Quick Cleanup (Recommended)

Remove all boxes and build artifacts:
```bash
make remove-boxes  # Remove all custom boxes from Vagrant
make clean-box     # Remove build artifacts
```

**Note:** If hub and agents use same OS, only one box is removed. If different OS, both are removed.

### Selective Cleanup

**Option 1: Remove Boxes from Vagrant Only**

Removes boxes from Vagrant's box list, but keeps the `.box` files on disk (useful if you want to re-add later):
```bash
make remove-boxes
```

Equivalent to:
```bash
vagrant box remove demo-in-a-box/ubuntu-jammy-horizon
vagrant box remove demo-in-a-box/ubuntu-noble-horizon
vagrant box remove demo-in-a-box/fedora-41-horizon
```

**Remove specific box:**
```bash
vagrant box remove demo-in-a-box/ubuntu-jammy-horizon  # Ubuntu 22
vagrant box remove demo-in-a-box/ubuntu-noble-horizon  # Ubuntu 24
vagrant box remove demo-in-a-box/fedora-41-horizon     # Fedora 41
```

**Option 2: Clean Build Artifacts Only**

Removes build files but keeps the box registered in Vagrant (useful if you want to rebuild):
```bash
make clean-box
```

This removes:
- `packer_output/` directory (Packer's temporary build folder)
- `*-horizon-virtualbox-*.box` files (all built box files)
- `box-metadata.json` (metadata file)

### Complete System Cleanup

To completely reset and remove everything related to the custom box:

```bash
# Step 1: Destroy all running VMs
make down

# Step 2: Remove all custom boxes from Vagrant
make remove-boxes

# Step 3: Clean all build artifacts
make clean-box

# Step 4: Verify cleanup
vagrant box list | grep horizon
# Should return nothing
```

### Verify Cleanup

Check what's still present:
```bash
# List all Vagrant boxes
vagrant box list

# Check for build artifacts
ls -lh ubuntu-jammy-horizon-virtualbox-*.box 2>/dev/null || echo "No box files found"
ls -lh box-metadata.json 2>/dev/null || echo "No metadata found"
ls -d packer_output 2>/dev/null || echo "No packer output directory"
```

### Disk Space Recovery

Custom boxes consume disk space in multiple locations:

| Location | Size per Box | Cleanup Command |
|----------|--------------|-----------------|
| Build artifacts | ~500MB-1GB | `make clean-box` |
| Vagrant box cache | ~500MB-1GB | `make remove-boxes` |
| VM instances | Varies | `make down` |

**Total recoverable:**
- Single OS: ~1-2GB + VM instances
- All three OS: ~4-6GB + VM instances

To see actual disk usage:
```bash
# Box cache location (macOS/Linux)
du -sh ~/.vagrant.d/boxes/demo-in-a-box-VAGRANTSLASH-ubuntu-jammy-horizon

# VirtualBox VMs
VBoxManage list vms
du -sh ~/VirtualBox\ VMs/*
```

## Advanced: Hosting Custom Box

### Local File Server

For sharing across team:
```bash
python3 -m http.server 8080
```

Update Vagrantfiles:
```ruby
# For Ubuntu 22
config.vm.box = "demo-in-a-box/ubuntu-jammy-horizon"
config.vm.box_url = "http://your-server:8080/ubuntu-jammy-horizon-virtualbox-1.0.0.box"

# For Ubuntu 24
config.vm.box = "demo-in-a-box/ubuntu-noble-horizon"
config.vm.box_url = "http://your-server:8080/ubuntu-noble-horizon-virtualbox-1.0.0.box"

# For Fedora 41
config.vm.box = "demo-in-a-box/fedora-41-horizon"
config.vm.box_url = "http://your-server:8080/fedora-41-horizon-virtualbox-1.0.0.box"
```

### Vagrant Cloud (Public/Private)

1. Create account at https://app.vagrantup.com
2. Create boxes:
   - `demo-in-a-box/ubuntu-jammy-horizon`
   - `demo-in-a-box/ubuntu-noble-horizon`
   - `demo-in-a-box/fedora-41-horizon`
3. Upload respective `.box` files
4. Vagrantfiles will automatically use cloud-hosted boxes

## Reverting to Original Configuration

If you want to switch back to the standard Ubuntu base box without the custom box:

### Temporary Revert (Environment Variables)

Use this for testing or one-time provisioning:

```bash
# Clean up any existing VMs
make down

# Use standard Ubuntu 22 box
export HUB_BOX_NAME=ubuntu/jammy64
export AGENT_BOX_NAME=ubuntu/jammy64
make init

# Or use standard Ubuntu 24 box
export HUB_BOX_NAME=ubuntu/noble64
export AGENT_BOX_NAME=ubuntu/noble64
make init

# Or use standard Fedora 41 box
export HUB_BOX_NAME=bento/fedora-41
export AGENT_BOX_NAME=bento/fedora-41
make init
```

**Note:** This is temporary. Next time you run `make init` without setting these variables, it will use the custom boxes again (if installed).

### Permanent Revert (Edit Vagrantfiles)

To permanently revert to standard Ubuntu box:

**Option 1: Edit Vagrantfile.hub**
```bash
# Change from:
config.vm.box = ENV.fetch('HUB_BOX_NAME', 'demo-in-a-box/ubuntu-jammy-horizon')
config.vm.box_version = ENV.fetch('BOX_VERSION', '1.0.0')

# To (for Ubuntu 22):
config.vm.box = "ubuntu/jammy64"
# Remove box_version line to use latest

# Or (for Ubuntu 24):
config.vm.box = "ubuntu/noble64"

# Or (for Fedora 41):
config.vm.box = "bento/fedora-41"
```

**Option 2: Edit Vagrantfile.template.erb**
```bash
# Change from:
agent<%= i %>.vm.box = ENV.fetch('AGENT_BOX_NAME', 'demo-in-a-box/ubuntu-jammy-horizon')
agent<%= i %>.vm.box_version = ENV.fetch('BOX_VERSION', '1.0.0')

# To:
agent<%= i %>.vm.box = "ubuntu/jammy64"  # or bento/ubuntu-24.04 or bento/fedora-41
# Remove box_version line to use latest
```

**Important:** If reverting permanently, you'll also need to restore the package installation commands that were removed:

```bash
# Add back to both Vagrantfiles in the provisioning section:
apt-get -y update
apt-get -y upgrade
apt-get install -y gcc make git curl jq net-tools docker.io docker-compose-v2
```

### Clean Up Custom Boxes After Reverting

After reverting, you may want to remove all custom boxes:

```bash
# Remove all custom boxes from Vagrant
make remove-boxes

# Clean build artifacts
make clean-box

# Verify removal
vagrant box list | grep horizon
# Should return nothing
```

### Why You Might Revert

- **Packer not available:** Can't build custom box on this machine
- **Debugging issues:** Test if problem is related to custom box
- **Standard workflow:** Team prefers standard provisioning process
- **Disk space:** Need to free up ~5GB immediately

### Switching Back to Custom Boxes

If you reverted but want to use custom boxes again:

```bash
# If you kept the .box files
vagrant box add --name demo-in-a-box/ubuntu-jammy-horizon ubuntu-jammy-horizon-virtualbox-1.0.0.box
vagrant box add --name demo-in-a-box/ubuntu-noble-horizon ubuntu-noble-horizon-virtualbox-1.0.0.box
vagrant box add --name demo-in-a-box/fedora-41-horizon fedora-41-horizon-virtualbox-1.0.0.box

# If you deleted everything, rebuild
make rebuild-boxes

# Then provision
make init
```
