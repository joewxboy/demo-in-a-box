# Mixed Operating System Environments

This guide explains how to run Open Horizon demonstrations with different operating systems for hub and agent VMs.

## Supported Combinations

✅ **All Combinations Supported:**
- Ubuntu 22 hub + Ubuntu 22 agents (default)
- Ubuntu 22 hub + Ubuntu 24 agents
- Ubuntu 22 hub + Fedora 41 agents
- Ubuntu 24 hub + Ubuntu 22 agents
- Ubuntu 24 hub + Ubuntu 24 agents
- Ubuntu 24 hub + Fedora 41 agents
- Fedora 41 hub + Ubuntu 22 agents
- Fedora 41 hub + Ubuntu 24 agents
- Fedora 41 hub + Fedora 41 agents

## Quick Start Examples

### Example 1: Cross-Platform Testing (Ubuntu + Fedora)

Test Open Horizon cross-platform compatibility:

```bash
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=fedora-41
make rebuild-boxes
make init
```

### Example 2: Latest Ubuntu Stack

Run on the newest LTS:

```bash
export HUB_OS_TYPE=ubuntu-24
export AGENT_OS_TYPE=ubuntu-24
make rebuild-boxes
make init
```

### Example 3: Fedora-First Environment

```bash
export HUB_OS_TYPE=fedora-41
export AGENT_OS_TYPE=fedora-41
make rebuild-boxes
make init
```

### Example 4: Mixed LTS Versions

```bash
export HUB_OS_TYPE=ubuntu-24
export AGENT_OS_TYPE=ubuntu-22
export SYSTEM_CONFIGURATION=bicycle
make rebuild-boxes
make init
```

## Changing the Project Default

To change the default OS for all new installations, you can set the `DEFAULT_OS_TYPE` environment variable or modify the Makefile:

### Using Environment Variable

```bash
export DEFAULT_OS_TYPE=ubuntu-24
make check  # Verify new default
make rebuild-boxes
make init
```

### Modifying Makefile (Permanent)

Edit the Makefile and change:

```makefile
# From:
DEFAULT_OS_TYPE ?= ubuntu-22

# To your preferred default:
DEFAULT_OS_TYPE ?= ubuntu-24
```

## Verification

After provisioning mixed-OS environments, verify communication:

### On Hub VM

```bash
make connect-hub

# Check what OS the hub is running
cat /etc/os-release

# Verify all agents registered
hzn exchange node list
```

### On Agent VMs

```bash
make connect VMNAME=agent1

# Check what OS the agent is running
cat /etc/os-release

# Verify connection to hub
hzn exchange status
hzn node list
```

## Troubleshooting Mixed Environments

### Issue: Agent can't connect to hub

**Symptoms:** `hzn exchange status` fails

**Solutions:**
1. Verify network connectivity: `ping 192.168.56.10`
2. Check firewall on hub:
   - Ubuntu: `sudo ufw status`
   - Fedora: `sudo firewall-cmd --list-ports`
3. Verify Exchange is running on hub: `curl http://192.168.56.10:3090/v1/admin/version`

### Issue: Different package versions

**Symptoms:** `hzn version` shows different versions on hub vs agents

**Expected Behavior:** Open Horizon agent-install.sh installs latest version regardless of OS

**Verify:** Both hub and agents should show same Horizon version

### Issue: Docker compatibility

**Symptoms:** Workloads fail to deploy

**Solutions:**
1. Check Docker version: `docker --version`
2. Verify Docker is running: `systemctl status docker`
3. Test Docker: `docker run hello-world`

### Issue: Firewall blocking connections

**Ubuntu (UFW):**
```bash
sudo ufw status
sudo ufw allow 3090/tcp
sudo ufw allow 3111/tcp
sudo ufw allow 9008/tcp
sudo ufw allow 9443/tcp
```

**Fedora (firewalld):**
```bash
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3090/tcp
sudo firewall-cmd --permanent --add-port=3111/tcp
sudo firewall-cmd --permanent --add-port=9008/tcp
sudo firewall-cmd --permanent --add-port=9443/tcp
sudo firewall-cmd --reload
```

## Performance Considerations

- **Disk Usage:** Each OS requires separate custom box (~500MB-1GB each)
- **Build Time:** Building 2 different OS boxes takes ~20-30 minutes total
- **RAM:** No difference in runtime RAM usage between OS
- **Provisioning Time:** Similar across all supported OS (OpenHorizon install is primary time sink)

## Known Limitations

1. **Firewall differences:** Ubuntu uses UFW, Fedora uses firewalld (both configured automatically)
2. **Package names:** Docker packages differ but are handled by provisioning scripts
3. **systemd variations:** Minor differences in service management (both supported)

## Build Management

### Building Multiple OS Boxes

```bash
# Build specific OS
make build-ubuntu-22
make build-ubuntu-24
make build-fedora-41

# Build for mixed environment (automatic - only builds needed boxes)
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=fedora-41
make build-boxes  # Builds both ubuntu-22 and fedora-41
```

### Disk Space Requirements

- Ubuntu 22 box: ~500-700MB
- Ubuntu 24 box: ~500-700MB
- Fedora 41 box: ~800MB-1GB
- Total for all three: ~2-2.5GB

### Cleaning Up

```bash
# Remove specific box
vagrant box remove demo-in-a-box/ubuntu-jammy-horizon
vagrant box remove demo-in-a-box/ubuntu-noble-horizon
vagrant box remove demo-in-a-box/fedora-41-horizon

# Clean build artifacts
make clean-box

# Remove all custom boxes and rebuild
make rebuild-boxes
```

## Advanced: Multi-Configuration Testing

Test the same system configuration across different OS combinations:

```bash
# Test unicycle on all OS combinations
for hub in ubuntu-22 ubuntu-24 fedora-41; do
  for agent in ubuntu-22 ubuntu-24 fedora-41; do
    echo "Testing $hub hub + $agent agents"
    export HUB_OS_TYPE=$hub
    export AGENT_OS_TYPE=$agent
    make rebuild-boxes
    make init
    # Run your tests here
    make down
  done
done
```

## Best Practices

1. **Use custom boxes:** Pre-built boxes save 5-10 minutes per VM provisioning
2. **Test cross-platform:** If deploying to heterogeneous environments, test mixed-OS scenarios
3. **Version consistency:** Use same `BOX_VERSION` for all custom boxes
4. **Clean between tests:** Run `make down` and `make clean-box` between different OS tests
5. **Check OS after provisioning:** Always verify VMs are running expected OS with `cat /etc/os-release`

## Compatibility Matrix

| Component | Ubuntu 22 | Ubuntu 24 | Fedora 41 |
|-----------|-----------|-----------|-----------|
| Open Horizon Hub | ✅ | ✅ | ✅ |
| Open Horizon Agent | ✅ | ✅ | ✅ |
| Docker | docker.io | docker.io | docker-ce |
| Firewall | UFW | UFW | firewalld |
| Package Manager | apt | apt | dnf |

All combinations are tested and supported for demonstration purposes.
