#!/bin/bash
set -e

echo '==> Updating system packages'
sudo dnf -y upgrade

echo '==> Installing Open Horizon dependencies'
sudo dnf -y install \
  gcc \
  make \
  git \
  curl \
  jq \
  net-tools \
  dnf-plugins-core

echo '==> Adding Docker repository'
sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo

echo '==> Installing Docker'
sudo dnf -y install \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-compose-plugin

echo '==> Enabling docker service'
sudo systemctl enable docker

echo '==> Cleaning up package cache'
sudo dnf clean all

echo '==> Fedora 41 provisioning complete'
rpm -qa | grep -E '(gcc|make|git|curl|jq|net-tools|docker)'
