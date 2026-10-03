#!/usr/bin/env bash
set -euo pipefail
desktop_test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$desktop_test_dir/desktop-test.py" "$@"
