#!/usr/bin/env bash
set -eu
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null; then
  echo 'Python 3 is required. It is included with Linux Mint 22.' >&2
  exit 1
fi
exec python3 "$script_dir/scripts/netmd-probe.py" "$@"
