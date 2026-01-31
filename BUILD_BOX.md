# Custom Vagrant Box Build Guide

This guide explains how to build the custom `demo-in-a-box/ubuntu-jammy-horizon` Vagrant box with pre-installed dependencies.

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

## Build Process

### Option 1: Using Make (Recommended)

```bash
make rebuild-box
```

This will:
1. Remove any existing custom box from Vagrant
2. Clean previous build artifacts
3. Build new box with Packer
4. Add the new box to Vagrant

### Option 2: Manual Steps

**Step 1: Initialize Packer**
```bash
packer init ubuntu-jammy-horizon.pkr.hcl
```

**Step 2: Validate Template**
```bash
packer validate ubuntu-jammy-horizon.pkr.hcl
```

**Step 3: Build Box**
```bash
packer build -var "box_version=1.0.0" ubuntu-jammy-horizon.pkr.hcl
```

This will:
- Download ubuntu/jammy64 base box
- Update system packages
- Install all Open Horizon dependencies (gcc, make, git, curl, jq, net-tools, docker.io, docker-compose-v2)
- Clean up package cache
- Compress and create box file

Build time: ~10-15 minutes depending on network speed

**Step 4: Add Box to Vagrant**
```bash
vagrant box add --name demo-in-a-box/ubuntu-jammy-horizon ubuntu-jammy-horizon-virtualbox-1.0.0.box
```

**Step 5: Verify Box**
```bash
vagrant box list | grep ubuntu-jammy-horizon
```

## Versioning

The box version is controlled by the `BOX_VERSION` variable:

```bash
export BOX_VERSION=1.1.0
make rebuild-box
```

## What Gets Pre-installed

The custom box includes:
- **System**: Ubuntu 22.04 LTS (Jammy Jellyfish) fully updated
- **Build Tools**: gcc, make, git
- **Utilities**: curl, jq, net-tools
- **Container Runtime**: docker.io, docker-compose-v2
- **Size**: ~2.5GB compressed

## Benefits

Compared to base ubuntu/jammy64:
- ⏱️ **Time Savings**: 5-10 minutes per VM (no package installation)
- 📦 **Consistent**: All VMs use identical base configuration
- 🌐 **Network**: Reduces bandwidth usage during provisioning
- ✅ **Reliable**: Pre-tested package versions

## Updating the Box

When dependencies need updating:

1. Modify `ubuntu-jammy-horizon.pkr.hcl` provisioner section
2. Increment version: `export BOX_VERSION=1.1.0`
3. Rebuild: `make rebuild-box`
4. Test with unicycle: `make init`
5. Commit changes with version number in commit message

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

Remove both box and build artifacts:
```bash
make remove-box    # Remove from Vagrant
make clean-box     # Remove build artifacts
```

### Selective Cleanup

**Option 1: Remove Box from Vagrant Only**

Removes the box from Vagrant's box list, but keeps the `.box` file on disk (useful if you want to re-add later):
```bash
make remove-box
```

Equivalent to:
```bash
vagrant box remove demo-in-a-box/ubuntu-jammy-horizon
```

**Option 2: Clean Build Artifacts Only**

Removes build files but keeps the box registered in Vagrant (useful if you want to rebuild):
```bash
make clean-box
```

This removes:
- `packer_output/` directory (Packer's temporary build folder)
- `ubuntu-jammy-horizon-virtualbox-*.box` files (built box files)
- `box-metadata.json` (metadata file)

### Complete System Cleanup

To completely reset and remove everything related to the custom box:

```bash
# Step 1: Destroy all running VMs
make down

# Step 2: Remove custom box from Vagrant
make remove-box

# Step 3: Clean all build artifacts
make clean-box

# Step 4: Verify cleanup
vagrant box list | grep ubuntu-jammy-horizon
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

The custom box consumes disk space in multiple locations:

| Location | Size | Cleanup Command |
|----------|------|-----------------|
| Build artifacts | ~2.5GB | `make clean-box` |
| Vagrant box cache | ~2.5GB | `make remove-box` |
| VM instances | Varies | `make down` |

**Total recoverable:** ~5GB + VM instance sizes

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
config.vm.box = "demo-in-a-box/ubuntu-jammy-horizon"
config.vm.box_url = "http://your-server:8080/ubuntu-jammy-horizon-virtualbox-1.0.0.box"
```

### Vagrant Cloud (Public/Private)

1. Create account at https://app.vagrantup.com
2. Create box: `demo-in-a-box/ubuntu-jammy-horizon`
3. Upload `.box` file
4. Update Vagrantfiles to use cloud-hosted box

## Reverting to Original Configuration

If you want to switch back to the standard Ubuntu base box without the custom box:

### Temporary Revert (Environment Variables)

Use this for testing or one-time provisioning:

```bash
# Clean up any existing VMs
make down

# Use standard Ubuntu box
export BOX_NAME=ubuntu/jammy64
export BOX_VERSION=20240126.0.0
make init
```

**Note:** This is temporary. Next time you run `make init` without setting these variables, it will use the custom box again (if installed).

### Permanent Revert (Edit Vagrantfiles)

To permanently revert to standard Ubuntu box:

**Option 1: Edit Vagrantfile.hub**
```bash
# Change from:
config.vm.box = ENV.fetch('BOX_NAME', 'demo-in-a-box/ubuntu-jammy-horizon')
config.vm.box_version = ENV.fetch('BOX_VERSION', '1.0.0')

# To:
config.vm.box = "ubuntu/jammy64"
config.vm.box_version = "20240126.0.0"
```

**Option 2: Edit Vagrantfile.template.erb**
```bash
# Change from:
agent<%= i %>.vm.box = ENV.fetch('BOX_NAME', 'demo-in-a-box/ubuntu-jammy-horizon')
agent<%= i %>.vm.box_version = ENV.fetch('BOX_VERSION', '1.0.0')

# To:
agent<%= i %>.vm.box = "ubuntu/jammy64"
agent<%= i %>.vm.box_version = "20240126.0.0"
```

**Important:** If reverting permanently, you'll also need to restore the package installation commands that were removed:

```bash
# Add back to both Vagrantfiles in the provisioning section:
apt-get -y update
apt-get -y upgrade
apt-get install -y gcc make git curl jq net-tools docker.io docker-compose-v2
```

### Clean Up Custom Box After Reverting

After reverting, you may want to remove the custom box entirely:

```bash
# Remove custom box from Vagrant
make remove-box

# Clean build artifacts
make clean-box

# Verify removal
vagrant box list | grep ubuntu-jammy-horizon
# Should return nothing
```

### Why You Might Revert

- **Packer not available:** Can't build custom box on this machine
- **Debugging issues:** Test if problem is related to custom box
- **Standard workflow:** Team prefers standard provisioning process
- **Disk space:** Need to free up ~5GB immediately

### Switching Back to Custom Box

If you reverted but want to use the custom box again:

```bash
# If you kept the .box file
vagrant box add --name demo-in-a-box/ubuntu-jammy-horizon ubuntu-jammy-horizon-virtualbox-1.0.0.box

# If you deleted everything, rebuild
make rebuild-box

# Then provision
make init
```
