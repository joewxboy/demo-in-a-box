packer {
  required_plugins {
    vagrant = {
      version = "~> 1"
      source  = "github.com/hashicorp/vagrant"
    }
  }
}

variable "box_version" {
  type    = string
  default = "1.0.0"
  description = "Version number for the custom box"
}

source "vagrant" "ubuntu-jammy" {
  communicator = "ssh"
  source_path  = "ubuntu/jammy64"
  provider     = "virtualbox"
  
  output_dir = "packer_output"
  teardown_method = "destroy"
  skip_add = true
}

build {
  sources = ["source.vagrant.ubuntu-jammy"]
  
  provisioner "shell" {
    script = "packer/scripts/provision-ubuntu-22.sh"
  }
  
  provisioner "shell" {
    script = "packer/scripts/common-cleanup.sh"
  }
  
  post-processor "shell-local" {
    script = "packer/scripts/post-process.sh"
    environment_vars = [
      "BOX_NAME=demo-in-a-box/ubuntu-jammy-horizon",
      "BOX_VERSION=${var.box_version}",
      "OUTPUT_FILE=ubuntu-jammy-horizon-virtualbox-${var.box_version}.box"
    ]
  }
}
