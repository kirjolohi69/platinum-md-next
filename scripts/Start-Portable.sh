#!/usr/bin/env bash
set -euo pipefail
portable_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null; then
  echo 'Python 3 is required. It is included with supported Linux Mint and Ubuntu desktops.' >&2
  exit 1
fi
exec python3 "$portable_dir/start-platinum.py" "$@"
