#!/bin/bash
set -e

echo '==> Setting non-interactive mode'
export DEBIAN_FRONTEND=noninteractive

echo '==> Updating package lists'
sudo apt-get -y update

echo '==> Upgrading system packages'
sudo apt-get -y upgrade --no-install-recommends

echo '==> Installing Open Horizon dependencies'
sudo apt-get install -y --no-install-recommends \
  gcc \
  make \
  git \
  curl \
  jq \
  net-tools \
  docker.io \
  docker-compose-v2

echo '==> Enabling docker service'
sudo systemctl enable docker

echo '==> Cleaning up package cache'
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*

echo '==> Ubuntu 22 provisioning complete'
dpkg -l | grep -E '(gcc|make|git|curl|jq|net-tools|docker)'
