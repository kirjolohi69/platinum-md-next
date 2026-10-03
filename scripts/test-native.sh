#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-$project_dir/.cache/native/netmd-patched}"
pkg_config="${PKG_CONFIG:-pkg-config}"
mkdir -p "$project_dir/.cache"
test_dir="$(mktemp -d "$project_dir/.cache/native-test.XXXXXXXX")"
trap 'rm -rf -- "$test_dir"' EXIT
read -r -a usb_flags <<< "$("$pkg_config" --cflags libusb-1.0)"
cc -O2 -g -UNDEBUG "${usb_flags[@]}" -I"$source_dir/libnetmd" \
  "$project_dir/test/native/capacity.c" "$source_dir/libnetmd/playercontrol.c" \
  "$source_dir/libnetmd/utils.c" "$source_dir/libnetmd/log.c" \
  -o "$test_dir/capacity-test"
"$test_dir/capacity-test"
read -r -a crypto_flags <<< "$("$pkg_config" --cflags libgcrypt)"
read -r -a crypto_libs <<< "$("$pkg_config" --libs libgcrypt)"
for suite in transport secure disc-header recording closing media-presence; do
  case "$suite" in
    transport) implementation=(common) ;;
    secure) implementation=(secure) ;;
    disc-header) implementation=(libnetmd) ;;
    recording) implementation=(send) ;;
    closing) implementation=(common secure) ;;
    media-presence) implementation=(playercontrol) ;;
  esac
  sources=("$project_dir/test/native/$suite.c" "$source_dir/libnetmd/utils.c" "$source_dir/libnetmd/log.c" "$source_dir/libnetmd/error.c")
  for name in "${implementation[@]}"; do sources+=("$source_dir/libnetmd/$name.c"); done
  cc -O2 -g -UNDEBUG -ffunction-sections -fdata-sections "${usb_flags[@]}" "${crypto_flags[@]}" \
    -I"$source_dir/libnetmd" "${sources[@]}" -Wl,--gc-sections "${crypto_libs[@]}" -o "$test_dir/$suite-test"
  "$test_dir/$suite-test" "$test_dir/recording-input.wav"
done
