# Platinum-MD Next 1.3.0

- **Runs on more Linux systems.** The app is now built on Ubuntu 22.04, so one installer covers more systems. The `.deb` installs on Debian 12 and 13, Ubuntu 22.04 and newer, Linux Mint 21 and newer, and other systems based on them. Before, it needed Ubuntu 24.04 / Mint 22 or newer.
- **New `.rpm` installer** for Fedora and openSUSE (Tumbleweed and Leap 15.6).
- **Arch Linux:** a `PKGBUILD` in `packaging/arch` builds an Arch package from the release with `makepkg -si`.
- Every build now installs the packages on Debian 12 and 13, Ubuntu 22.04 and 24.04, Fedora 42, openSUSE Tumbleweed and Leap 15.6, and Arch Linux. It checks that the app and all its helper programs find every library they need, then removes them again. These are automatic checks without a recorder; recording is tested on Linux Mint with a Sony MZ-N910.
- The recording features are unchanged from 1.2.0. The bundled helper programs (NetMD, audio conversion, CD reading) are rebuilt from the same sources, against older system libraries.
