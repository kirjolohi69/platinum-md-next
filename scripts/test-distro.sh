#!/usr/bin/env bash
# Install the built package on another Linux distribution in a container,
# check that the app and its helpers find every library they need, then
# remove it again. Usage: scripts/test-distro.sh <image>
# Needs docker and the packages in release/ (and packaging/arch for Arch).
set -euo pipefail
image="$1"
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
deb="$(ls "$project_dir"/release/Platinum-MD-Next-*-linux-amd64.deb)"
rpm="$(ls "$project_dir"/release/Platinum-MD-Next-*-linux-x86_64.rpm)"
setup="${PLATINUM_TEST_SETUP:-}"

docker run --rm -i -e DEBIAN_FRONTEND=noninteractive ${PLATINUM_DOCKER_ARGS:-} \
  -v "$deb:/pkg/app.deb:ro" -v "$rpm:/pkg/app.rpm:ro" -v "$project_dir/packaging/arch:/pkg/arch:ro" \
  ${setup:+-v "$setup:/pkg/setup.sh:ro"} "$image" bash -s <<'EOF'
set -euo pipefail
[ -f /pkg/setup.sh ] && . /pkg/setup.sh
. /etc/os-release
echo "== Installing on $PRETTY_NAME"
case "$ID ${ID_LIKE:-}" in
  *debian*|*ubuntu*)
    apt-get update -qq
    apt-get install -y -qq /pkg/app.deb >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
    remove() { apt-get remove -y -qq platinum-md-next >/dev/null; } ;;
  *fedora*)
    dnf install -y -q /pkg/app.rpm
    remove() { dnf remove -y -q platinum-md-next; } ;;
  *suse*)
    # openSUSE's download network sometimes refuses a metadata file; try again.
    for attempt in 1 2 3; do zypper --non-interactive --quiet refresh && break; sleep 20; done
    zypper --non-interactive --quiet install --allow-unsigned-rpm /pkg/app.rpm
    remove() { zypper --non-interactive --quiet remove platinum-md-next; } ;;
  *arch*)
    pacman -Syu --noconfirm --needed --quiet base-devel sudo >/dev/null
    useradd -m builder && echo 'builder ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/builder
    install -d -o builder /home/builder/pkg
    cp /pkg/arch/* /pkg/app.deb /home/builder/pkg/ && chown builder /home/builder/pkg/*
    cd /home/builder/pkg
    # Build from the package under test instead of the published release.
    sed -i -e "s|^source=.*|source=(\"app.deb\")|" -e "s|^sha256sums=.*|sha256sums=('$(sha256sum app.deb | cut -d' ' -f1)')|" \
      -e "s|^pkgver=.*|pkgver=0.0.0|" PKGBUILD
    sudo -u builder makepkg -si --noconfirm >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
    remove() { pacman -R --noconfirm platinum-md-next-bin >/dev/null; } ;;
  *) echo "Unsupported test image: $ID"; exit 1 ;;
esac

app='/opt/Platinum-MD Next'
test -x /usr/bin/platinum-md-next
test -f /usr/share/applications/platinum-md-next.desktop
test -f /usr/lib/udev/rules.d/70-platinum-md-next.rules
missing="$(ldd "$app/platinum-md-next" | grep 'not found' || true)"
[ -z "$missing" ] || { echo "Missing desktop libraries:"; echo "$missing"; exit 1; }
export LD_LIBRARY_PATH="$app/resources/native/lib" LC_ALL=C
for helper in 'netmdcli help' 'ffmpeg -version' 'ffprobe -version' 'atracdenc -h' 'cdparanoia -V'; do
  set -- $helper
  "$app/resources/native/bin/$1" "${@:2}" >/dev/null 2>&1 || { echo "Helper failed: $helper"; "$app/resources/native/bin/$1" "${@:2}" 2>&1 | tail -5; exit 1; }
done
echo "App and helpers: all libraries found"
remove
test ! -e /usr/bin/platinum-md-next
test ! -e "$app"
echo "== Passed on $PRETTY_NAME"
EOF
