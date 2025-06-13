#!/bin/sh
# Unset proxy environment variables to avoid npm warnings
unset npm_config_http_proxy npm_config_https_proxy HTTP_PROXY HTTPS_PROXY

# Run Jest with experimental VM modules
NODE_OPTIONS=--experimental-vm-modules npx jest "$@"
