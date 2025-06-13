#!/bin/sh
# Unset proxy environment variables to avoid npm warnings
unset npm_config_http_proxy npm_config_https_proxy HTTP_PROXY HTTPS_PROXY \
  http_proxy https_proxy

# Verify Jest is installed to avoid npx prompts
if [ ! -x node_modules/.bin/jest ]; then
  echo "Error: Jest is not installed. Run 'npm ci' or 'npm install' first." >&2
  exit 1
fi

# Run Jest with experimental VM modules
NODE_OPTIONS=--experimental-vm-modules npx --no-install jest "$@"
