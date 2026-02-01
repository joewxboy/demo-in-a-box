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

source "vagrant" "fedora-41" {
  communicator = "ssh"
  source_path  = "bento/fedora-41"
  provider     = "virtualbox"
  
  output_dir = "packer_output"
  teardown_method = "destroy"
  skip_add = true
}

build {
  sources = ["source.vagrant.fedora-41"]
  
  provisioner "shell" {
    script = "packer/scripts/provision-fedora-41.sh"
  }
  
  provisioner "shell" {
    script = "packer/scripts/common-cleanup.sh"
  }
  
  post-processor "shell-local" {
    script = "packer/scripts/post-process.sh"
    environment_vars = [
      "BOX_NAME=demo-in-a-box/fedora-41-horizon",
      "BOX_VERSION=${var.box_version}",
      "OUTPUT_FILE=fedora-41-horizon-virtualbox-${var.box_version}.box"
    ]
  }
}
