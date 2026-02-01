# Testing Checklist for Multi-OS Support

This document provides manual testing procedures for verifying multi-OS functionality.

## Pre-Testing Setup

1. **Clean environment:**
   ```bash
   make down
   vagrant box list  # Note existing boxes
   ```

2. **Free disk space check:**
   ```bash
   df -h  # Ensure 5GB+ available
   ```

## Test Suite 1: Single-OS Builds

### Test 1.1: Ubuntu 22 (Baseline)

**Purpose:** Verify default configuration still works

```bash
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=ubuntu-22
make rebuild-boxes
make init
```

**Verification:**
- [ ] Packer build completes without errors
- [ ] Hub VM provisions successfully
- [ ] Agent VM provisions successfully
- [ ] `make connect-hub` works
- [ ] `make connect VMNAME=agent1` works
- [ ] On hub: `hzn exchange node list` shows 2 nodes
- [ ] On agent: `hzn node list` shows HelloWorld workload
- [ ] `make down` completes cleanly

**Expected Time:** 25-35 minutes

---

### Test 1.2: Ubuntu 24

**Purpose:** Verify Ubuntu 24 support

```bash
make down
export HUB_OS_TYPE=ubuntu-24
export AGENT_OS_TYPE=ubuntu-24
make rebuild-boxes
make init
```

**Verification:**
- [ ] Packer build completes without errors
- [ ] Hub VM provisions successfully
- [ ] Agent VM provisions successfully
- [ ] On hub: `cat /etc/os-release | grep "VERSION_ID"` shows `24.04`
- [ ] On agent: `cat /etc/os-release | grep "VERSION_ID"` shows `24.04`
- [ ] `hzn exchange status` succeeds on agent
- [ ] `hzn node list` shows HelloWorld workload
- [ ] `make down` completes cleanly

**Expected Time:** 25-35 minutes

---

### Test 1.3: Fedora 41

**Purpose:** Verify Fedora support

```bash
make down
export HUB_OS_TYPE=fedora-41
export AGENT_OS_TYPE=fedora-41
make rebuild-boxes
make init
```

**Verification:**
- [ ] Packer build completes without errors
- [ ] Hub VM provisions successfully
- [ ] Agent VM provisions successfully
- [ ] On hub: `cat /etc/os-release | grep "VERSION_ID"` shows `43`
- [ ] On agent: `cat /etc/os-release | grep "VERSION_ID"` shows `43`
- [ ] `hzn exchange status` succeeds on agent
- [ ] `hzn node list` shows HelloWorld workload
- [ ] `make down` completes cleanly

**Expected Time:** 25-35 minutes

---

## Test Suite 2: Mixed-OS Environments

### Test 2.1: Ubuntu 22 Hub + Fedora 41 Agents

**Purpose:** Verify cross-platform compatibility (Debian hub + RPM agents)

```bash
make down
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=fedora-41
export SYSTEM_CONFIGURATION=bicycle  # 2 agents
make rebuild-boxes
make init
```

**Verification:**
- [ ] Both boxes build successfully
- [ ] Hub provisions as Ubuntu 22
- [ ] Agents provision as Fedora 41
- [ ] On hub: `hzn exchange node list` shows 3 nodes (hub + 2 agents)
- [ ] On agent1: OS is Fedora 41
- [ ] On agent1: `hzn exchange status` succeeds
- [ ] On agent2: HelloWorld workload running
- [ ] Network connectivity between different OS works
- [ ] `make down` completes cleanly

**Expected Time:** 35-45 minutes

---

### Test 2.2: Fedora 41 Hub + Ubuntu 24 Agents

**Purpose:** Verify reverse compatibility (RPM hub + Debian agents)

```bash
make down
export HUB_OS_TYPE=fedora-41
export AGENT_OS_TYPE=ubuntu-24
export SYSTEM_CONFIGURATION=bicycle
make rebuild-boxes
make init
```

**Verification:**
- [ ] Both boxes build successfully
- [ ] Hub provisions as Fedora 41
- [ ] Agents provision as Ubuntu 24
- [ ] On hub: `firewall-cmd --list-ports` shows 3090, 3111, 9008, 9443
- [ ] On agent1: `hzn exchange status` succeeds
- [ ] All agents registered with Fedora hub
- [ ] `make down` completes cleanly

**Expected Time:** 35-45 minutes

---

### Test 2.3: Ubuntu 24 Hub + Ubuntu 22 Agents

**Purpose:** Verify LTS version mixing

```bash
make down
export HUB_OS_TYPE=ubuntu-24
export AGENT_OS_TYPE=ubuntu-22
make rebuild-boxes
make init
```

**Verification:**
- [ ] Both VMs provision successfully
- [ ] Hub is Ubuntu 24.04
- [ ] Agent is Ubuntu 22.04
- [ ] Exchange communication works
- [ ] HelloWorld deploys successfully
- [ ] `make down` completes cleanly

**Expected Time:** 30-40 minutes

---

## Test Suite 3: Multi-Agent Configurations

### Test 3.1: Car Configuration (5 Agents, Mixed OS)

**Purpose:** Verify scaling with mixed OS

```bash
make down
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=fedora-41
export SYSTEM_CONFIGURATION=car  # 5 agents
make rebuild-boxes
make init
```

**Verification:**
- [ ] Hub provisions successfully
- [ ] All 5 agents provision successfully
- [ ] On hub: `hzn exchange node list` shows 6 nodes
- [ ] Can connect to each agent: `make connect VMNAME=agent5`
- [ ] All agents running HelloWorld workload
- [ ] RAM usage acceptable (<16GB total)
- [ ] `make down` completes cleanly

**Expected Time:** 45-60 minutes

**Requirements:** 16GB host RAM

---

## Test Suite 4: Edge Cases

### Test 4.1: Box Version Management

**Purpose:** Verify version handling

```bash
make down
export BOX_VERSION=2.0.0
export HUB_OS_TYPE=ubuntu-22
export AGENT_OS_TYPE=ubuntu-22
make rebuild-boxes
```

**Verification:**
- [ ] Box file named `ubuntu-jammy-horizon-virtualbox-2.0.0.box`
- [ ] `vagrant box list` shows version 2.0.0
- [ ] Provisioning uses correct version
- [ ] Older version can be removed with `vagrant box remove`

---

### Test 4.2: Standard Box Fallback

**Purpose:** Verify system works without custom boxes

```bash
make down
export HUB_BOX_NAME=ubuntu/jammy64
export AGENT_BOX_NAME=ubuntu/jammy64
make init
```

**Verification:**
- [ ] Uses standard Ubuntu box (not custom)
- [ ] Provisioning takes longer (packages not pre-installed)
- [ ] Final result identical to custom box
- [ ] `make down` completes cleanly

---

### Test 4.3: Rapid Rebuild

**Purpose:** Verify cleanup and rebuild cycle

```bash
make down
make clean-box
make rebuild-boxes
make init
```

**Verification:**
- [ ] Old boxes removed cleanly
- [ ] Build artifacts cleaned
- [ ] New boxes build successfully
- [ ] System provisions correctly

---

### Test 4.4: Convenience Targets

**Purpose:** Verify quick build shortcuts work

```bash
make down
make clean-box

# Test each convenience target
make build-ubuntu-22
make build-ubuntu-24
make build-fedora-41
```

**Verification:**
- [ ] Each target builds correct OS box
- [ ] Box files created with correct names
- [ ] All three boxes can coexist

---

## Test Suite 5: Error Conditions

### Test 5.1: Invalid OS Type

```bash
export HUB_OS_TYPE=invalid-os
make check
```

**Expected Result:**
- [ ] Error message: "Unknown OS_TYPE: invalid-os"
- [ ] Suggests valid options: ubuntu-22, ubuntu-24, fedora-41

---

### Test 5.2: Missing Box

```bash
make down
vagrant box remove demo-in-a-box/ubuntu-jammy-horizon || true
make init  # Without rebuild-boxes
```

**Expected Result:**
- [ ] Vagrant attempts to download missing box from cloud OR
- [ ] Clear error message about missing box

---

### Test 5.3: Partial Build Failure

**Purpose:** Verify system handles build interruption

```bash
make clean-box
# Start build then cancel with Ctrl+C after ~1 minute
make build-ubuntu-22
# Press Ctrl+C

# Verify cleanup
ls packer_output  # Should exist but incomplete
make clean-box
ls packer_output  # Should not exist
```

**Verification:**
- [ ] Partial build artifacts exist after cancel
- [ ] `make clean-box` removes all artifacts
- [ ] Subsequent build succeeds

---

## Reporting Results

After completing tests, document:

1. **Pass/Fail Status:** Which tests passed/failed
2. **Timing:** Actual provisioning times
3. **Issues:** Any unexpected behaviors
4. **Environment:** Host OS, VirtualBox version, Vagrant version, RAM

### Example Report Template

```
Test: 2.1 - Ubuntu 22 Hub + Fedora 41 Agents
Status: PASS
Time: 38 minutes
Environment: 
  - Host OS: Ubuntu 22.04
  - VirtualBox: 7.0.12
  - Vagrant: 2.4.0
  - Packer: 1.10.0
  - RAM: 16GB
Notes: All agents registered successfully, HelloWorld deployed on all agents
```

---

## Quick Smoke Test

For rapid verification after changes:

```bash
# Test default configuration only
make rebuild-boxes
make init
make connect-hub
hzn exchange node list  # Should show 2 nodes
make connect VMNAME=agent1
hzn node list  # Should show HelloWorld
exit
make down
```

**Expected Time:** ~25 minutes

This validates basic functionality without exhaustive testing.
