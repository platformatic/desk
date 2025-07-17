# What is this

`desk` is a CLI application for managing Kubernetes clusters locally using k3d.

# Code style
- use ES modules (import/export) syntax, not CommonJS
- destructure import when possible

# Structure
- _cli/_ defines the commands that are available
- _lib/_ logic for the application
- _charts/_ customization of various Helm charts that can be applied
- _.cache/_ charts, configuration, and Docker images for a fully-offline
  experience. This enables "airplane mode"
