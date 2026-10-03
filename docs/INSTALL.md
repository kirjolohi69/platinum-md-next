# Install Platinum-MD Next 1.3.0

Download the installer for your system from the [latest release](https://github.com/kirjolohi69/platinum-md-next/releases/latest). Each one contains the application, its desktop runtime, the NetMD helper, audio converters, CD reader, source and licenses.

## Supported systems

64-bit Intel or AMD computers with one of:

| System | Download |
| --- | --- |
| Debian 12 or 13, Ubuntu 22.04 or newer, Linux Mint 21 or newer, and systems based on them (Pop!_OS, Zorin OS, LMDE 6/7, MX Linux 23/25…) | `Platinum-MD-Next-1.3.0-linux-amd64.deb` |
| Fedora (current releases), openSUSE Tumbleweed, openSUSE Leap 15.6 | `Platinum-MD-Next-1.3.0-linux-x86_64.rpm` |
| Arch Linux and systems based on it | Build from `packaging/arch/PKGBUILD` (see below) |

Recording has been tested on Linux Mint 22.3 with a Sony MZ-N910. Every build is also installed automatically on Debian 12 and 13, Ubuntu 22.04 and 24.04, Fedora 42, openSUSE Tumbleweed and Leap 15.6, and Arch Linux to check that the app and its helpers find everything they need; those checks have no recorder attached. ARM computers (such as a Raspberry Pi) are not supported.

## Install

Finish any recording and close Platinum-MD Next and other MiniDisc programs first.

**Debian, Ubuntu, Mint:** double-click the `.deb` and use your system's package installer, or open a terminal in the download folder and run:

```bash
sudo apt install ./Platinum-MD-Next-1.3.0-linux-amd64.deb
```

**Fedora:**

```bash
sudo dnf install ./Platinum-MD-Next-1.3.0-linux-x86_64.rpm
```

**openSUSE:**

```bash
sudo zypper install --allow-unsigned-rpm ./Platinum-MD-Next-1.3.0-linux-x86_64.rpm
```

**Arch Linux:** with `git` and `base-devel` installed, run:

```bash
git clone https://github.com/kirjolohi69/platinum-md-next.git
cd platinum-md-next/packaging/arch
makepkg -si
```

This downloads the release `.deb`, checks its checksum and turns it into an Arch package.

Always install through the package manager, not by extracting files: it installs the desktop libraries the app needs and registers the app and its USB rules. Internet access may be needed for those libraries.

Then open **Platinum-MD Next** from your application menu and unplug and reconnect the recorder once, so the installed USB rules take effect. Start the app as your normal user, without `sudo`.

## Recording and removing the MiniDisc

Keep the recorder connected and powered until the app finishes recording. On the MZ-N910, after disconnecting, press the recorder's physical **STOP** button if the lid remains locked. Wait for **TOC Edit** to disappear before opening it. Do not remove power while disc information is being saved.

## CD reading speed

Use **Maximum** to let the CD reader request full drive speed. A number such as 24× is a request; the drive may limit or ignore it. Accurate extraction includes synchronization and error correction, and audio extraction can be slower than the drive's advertised data speed.

While one track is sent to the MiniDisc, the app already reads and encodes the next one. The status line shows the current step and what is being prepared meanwhile. If reading is unusually slow, save Diagnostics after a CD track: it records the time of each step.

## Update or remove

Install a newer version the same way, directly over the old one; no uninstall is needed. Saved appearance, CD speed and album information are kept. On Debian-based systems the package version may be shown as `1:1.3.0`; the leading `1:` keeps it newer than the old 2.0 test builds.

To remove the app:

| System | Command |
| --- | --- |
| Debian, Ubuntu, Mint | `sudo apt remove platinum-md-next` |
| Fedora | `sudo dnf remove platinum-md-next` |
| openSUSE | `sudo zypper remove platinum-md-next` |
| Arch Linux | `sudo pacman -R platinum-md-next-bin` |

Your personal settings are left in your home directory. The app and its USB rule are removed.

## Source and help

Use **Diagnostics → Save report** when reporting a problem. Reports may contain music titles and paths; review them before posting publicly.

The installed changelog is `/usr/share/doc/platinum-md-next/CHANGELOG.md`. The complete application Git history is `/usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle`. Native corresponding source and licenses are included under `/opt/Platinum-MD Next/resources/native/`.
