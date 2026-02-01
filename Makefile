# The Open Horizon organization ID namespace where you will be publishing files
export HZN_ORG_ID ?= myorg

VMNAME :=

# Which system configuration to be provisioned
export SYSTEM_CONFIGURATION ?= unicycle

# Configuration parameters for the ERB template
export NUM_AGENTS ?= 1
export BASE_IP ?= 20
export MEMORY ?= 2048
export DISK_SIZE ?= 20

export NETWORK_PREFIX ?= 192.168.56
export HUB_IP ?= $(NETWORK_PREFIX).10

# Map system configurations to parameters
ifeq ($(SYSTEM_CONFIGURATION),unicycle)
    NUM_AGENTS := 1
    BASE_IP := 20
    MEMORY := 2048
    DISK_SIZE := 20
else ifeq ($(SYSTEM_CONFIGURATION),bicycle)
    NUM_AGENTS := 3
    BASE_IP := 20
    MEMORY := 2048
    DISK_SIZE := 20
else ifeq ($(SYSTEM_CONFIGURATION),car)
    NUM_AGENTS := 5
    BASE_IP := 20
    MEMORY := 2048
    DISK_SIZE := 20
else ifeq ($(SYSTEM_CONFIGURATION),semi)
    NUM_AGENTS := 7
    BASE_IP := 20
    MEMORY := 2048
    DISK_SIZE := 20
endif

export VAGRANT_HUB := "./configuration/Vagrantfile.hub"
export VAGRANT_VAGRANTFILE := "./configuration/Vagrantfile.${SYSTEM_CONFIGURATION}"
export VAGRANT_TEMPLATE := "./configuration/Vagrantfile.template.erb"

export BOX_VERSION ?= 1.0.0
export BOX_NAME := demo-in-a-box/ubuntu-jammy-horizon

# Detect Operating System running Make
OS := $(shell uname -s)

default: status

check:
	@echo "=====================     ============================================="
	@echo "ENVIRONMENT VARIABLES     VALUES"
	@echo "=====================     ============================================="
	@echo "SYSTEM_CONFIGURATION      ${SYSTEM_CONFIGURATION}"
	@echo "NUM_AGENTS                ${NUM_AGENTS}"
	@echo "BASE_IP                   ${BASE_IP}"
	@echo "MEMORY                    ${MEMORY}"
	@echo "DISK_SIZE                 ${DISK_SIZE}"
	@echo "NETWORK_PREFIX            ${NETWORK_PREFIX}"
	@echo "HUB_IP                    ${HUB_IP}"
	@echo "BOX_NAME                  ${BOX_NAME}"
	@echo "BOX_VERSION               ${BOX_VERSION}"
	@echo "VAGRANT_HUB               ${VAGRANT_HUB}"
	@echo "VAGRANT_TEMPLATE          ${VAGRANT_TEMPLATE}"
	@echo "VAGRANT_VAGRANTFILE       ${VAGRANT_VAGRANTFILE}"
	@echo "HZN_ORG_ID                ${HZN_ORG_ID}"
	@echo "OS                        ${OS}"
	@echo "=====================     ============================================="
	@echo ""

# Detect host IP address (cross-platform)
detect-host-ip:
ifeq ($(OS),Darwin)
	@IFACE=$$(route -n get default 2>/dev/null | grep interface | awk '{print $$2}'); \
	if [ -n "$$IFACE" ]; then \
		IP=$$(ifconfig $$IFACE 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $$2}' | head -1); \
		if [ -n "$$IP" ]; then \
			echo "$$IP"; \
		else \
			echo "ERROR: Could not detect IP for interface $$IFACE" >&2; \
			exit 1; \
		fi; \
	else \
		echo "ERROR: Could not detect default network interface" >&2; \
		exit 1; \
	fi
else
	@IP=$$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+'); \
	if [ -z "$$IP" ]; then \
		IP=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	fi; \
	if [ -n "$$IP" ] && [ "$$IP" != "127.0.0.1" ]; then \
		echo "$$IP"; \
	else \
		echo "ERROR: Could not detect host IP address" >&2; \
		exit 1; \
	fi
endif

# Display detected host IP for verification
check-host-ip:
	@echo "Detected host IP address: $$($(MAKE) -s detect-host-ip)"

# Generate agent-install-external.env with host IP
agent-config-external:
	@echo "Generating agent-install-external.env..."
	@HOST_IP=$$($(MAKE) -s detect-host-ip); \
	if [ -z "$$HOST_IP" ]; then \
		echo "ERROR: Failed to detect host IP"; \
		exit 1; \
	fi; \
	echo "Using host IP: $$HOST_IP"; \
	echo "export HZN_EXCHANGE_URL=http://$$HOST_IP:3090/v1" > agent-install-external.env; \
	echo "export HZN_FSS_CSSURL=http://$$HOST_IP:9443/" >> agent-install-external.env; \
	echo "export HZN_AGBOT_URL=http://$$HOST_IP:3111" >> agent-install-external.env; \
	echo "export HZN_FDO_SVC_URL=http://$$HOST_IP:9008/api" >> agent-install-external.env; \
	chmod 644 agent-install-external.env; \
	echo "✓ Created agent-install-external.env with host IP $$HOST_IP"

# Generate agent-install-internal.env with hub VM IP
agent-config-internal:
	@echo "Generating agent-install-internal.env..."
	@echo "Using hub IP: $(HUB_IP)"; \
	echo "export HZN_EXCHANGE_URL=http://$(HUB_IP):3090/v1" > agent-install-internal.env; \
	echo "export HZN_FSS_CSSURL=http://$(HUB_IP):9443/" >> agent-install-internal.env; \
	echo "export HZN_AGBOT_URL=http://$(HUB_IP):3111" >> agent-install-internal.env; \
	echo "export HZN_FDO_SVC_URL=http://$(HUB_IP):9008/api" >> agent-install-internal.env; \
	chmod 644 agent-install-internal.env; \
	echo "✓ Created agent-install-internal.env with hub IP $(HUB_IP)"

# Generate both agent configuration files
generate-agent-configs: agent-config-external agent-config-internal
	@echo ""
	@echo "Agent configuration files generated successfully!"
	@echo ""
	@echo "Usage:"
	@echo "  - agent-install-external.env: For agents connecting from the host machine"
	@echo "  - agent-install-internal.env: For agents connecting from within VMs"
	@echo ""
	@echo "To use: export \$$(cat agent-install-external.env)"

init: up-hub up

up-hub: 
	@VAGRANT_VAGRANTFILE=$(VAGRANT_HUB) vagrant up
	@test -f mycreds.env || { echo "ERROR: Credentials file not generated. Hub provisioning may have failed."; exit 1; }
	@grep -q "HZN_ORG_ID" mycreds.env || { echo "ERROR: HZN_ORG_ID missing from mycreds.env"; exit 1; }
	@grep -q "HZN_EXCHANGE_USER_AUTH" mycreds.env || { echo "ERROR: HZN_EXCHANGE_USER_AUTH missing from mycreds.env"; exit 1; }
	@echo "Hub provisioning complete. Credentials validated."

up: 
	$(eval include ./mycreds.env)
	@erb hzn_org_id=${HZN_ORG_ID} hzn_exchange_user_auth=${HZN_EXCHANGE_USER_AUTH} num_agents=$(NUM_AGENTS) base_ip=$(BASE_IP) memory=$(MEMORY) disk_size=$(DISK_SIZE) $(VAGRANT_TEMPLATE) > $(VAGRANT_VAGRANTFILE)
	@VAGRANT_VAGRANTFILE=$(VAGRANT_VAGRANTFILE) vagrant up --parallel

connect-hub:
	@VAGRANT_VAGRANTFILE=$(VAGRANT_HUB) vagrant ssh

connect:
	@if [ -f $(VAGRANT_VAGRANTFILE) ]; then \
		VAGRANT_VAGRANTFILE=$(VAGRANT_VAGRANTFILE) vagrant ssh $(VMNAME); \
	else \
		echo "Error: Vagrantfile not found at $(VAGRANT_VAGRANTFILE). Run 'make up' first to generate it."; \
		exit 1; \
	fi

status:
	@if [ -f $(VAGRANT_VAGRANTFILE) ]; then \
		VAGRANT_VAGRANTFILE=$(VAGRANT_VAGRANTFILE) vagrant status; \
	else \
		echo "Error: Vagrantfile not found at $(VAGRANT_VAGRANTFILE). Run 'make up' first to generate it."; \
		exit 1; \
	fi

status-hub:
	@VAGRANT_VAGRANTFILE=$(VAGRANT_HUB) vagrant status

down: destroy destroy-hub clean

clean:
	@if [ -f $(VAGRANT_VAGRANTFILE) ]; then rm $(VAGRANT_VAGRANTFILE); fi
	@if [ -f summary.txt ]; then rm summary.txt; fi
	@if [ -f mycreds.env ]; then rm mycreds.env; fi
	@if [ -f agent-install-external.env ]; then rm agent-install-external.env; fi
	@if [ -f agent-install-internal.env ]; then rm agent-install-internal.env; fi
	@vagrant global-status --prune

destroy:
	@VAGRANT_VAGRANTFILE=$(VAGRANT_VAGRANTFILE) vagrant destroy -f

destroy-hub:
	@VAGRANT_VAGRANTFILE=$(VAGRANT_HUB) vagrant destroy -f

browse:
ifeq ($(OS),Darwin)
	@open http://127.0.0.1:8123
else
	@xdg-open http://127.0.0.1:8123
endif

build-box:
	@echo "Building custom Vagrant box with Packer..."
	@packer init ubuntu-jammy-horizon.pkr.hcl
	@packer build -var "box_version=$(BOX_VERSION)" ubuntu-jammy-horizon.pkr.hcl

add-box:
	@echo "Adding custom box to Vagrant..."
	@vagrant box add --name $(BOX_NAME) ubuntu-jammy-horizon-virtualbox-$(BOX_VERSION).box --force

remove-box:
	@echo "Removing custom box from Vagrant..."
	@vagrant box remove $(BOX_NAME) || true

clean-box:
	@echo "Cleaning Packer build artifacts..."
	@rm -rf packer_output
	@rm -f ubuntu-jammy-horizon-virtualbox-*.box
	@rm -f box-metadata.json

rebuild-box: remove-box clean-box build-box add-box

.PHONY: default check detect-host-ip check-host-ip agent-config-external agent-config-internal generate-agent-configs init up-hub up status down destroy browse connect clean connect-hub status-hub destroy-hub build-box add-box remove-box clean-box rebuild-box