#!/bin/sh
# Unset proxy environment variables to avoid npm warnings
unset npm_config_http_proxy npm_config_https_proxy HTTP_PROXY HTTPS_PROXY \
  http_proxy https_proxy

# Verify Jest is installed to avoid npx prompts
if [ ! -x node_modules/.bin/jest ]; then
  echo "Error: Jest is not installed. Run 'npm ci' or 'npm install' first." >&2
  exit 1
fi

# Run Jest serially with increased memory limit and experimental VM modules
# Execute each test file in a separate process to avoid memory leaks
export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-} --experimental-vm-modules"

if [ "$#" -eq 0 ]; then
  set -- $(npx --no-install jest --listTests)
fi

exit_code=0
for test_file in "$@"; do
  npx --no-install jest --runInBand "$test_file" || exit_code=1
done
exit $exit_code
