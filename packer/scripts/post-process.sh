#!/bin/bash
set -e

echo '==> Copying and renaming box file'
cp packer_output/package.box ${OUTPUT_FILE}

echo '==> Creating metadata file'
cat > box-metadata.json <<EOF
{
  "name": "${BOX_NAME}",
  "description": "Custom Vagrant box with Open Horizon dependencies pre-installed",
  "versions": [{
    "version": "${BOX_VERSION}",
    "providers": [{
      "name": "virtualbox",
      "url": "file://$(pwd)/${OUTPUT_FILE}"
    }]
  }]
}
EOF

echo ''
echo '========================================='
echo 'Custom box built successfully!'
echo '========================================='
echo "Box file: ${OUTPUT_FILE}"
echo 'Metadata: box-metadata.json'
echo ''
echo 'To add this box to Vagrant, run:'
echo "  vagrant box add --name ${BOX_NAME} ${OUTPUT_FILE}"
echo ''
