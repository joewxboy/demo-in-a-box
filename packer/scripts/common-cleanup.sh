#!/bin/bash
echo '==> Zeroing out free space to improve box compression'
sudo dd if=/dev/zero of=/EMPTY bs=1M || true
sudo rm -f /EMPTY
sync
