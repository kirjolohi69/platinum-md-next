# Install Platinum-MD Next 1.2.0

The main download is **Platinum-MD-Next-1.2.0-linux-amd64.deb**. It contains the application, desktop runtime, NetMD helper, audio converters, CD reader, source and licenses. No previous app folder is needed.

## Supported target

Linux Mint 22 / Ubuntu 24.04 on an Intel or AMD 64-bit computer, with glibc 2.39 or newer and normal desktop sandbox support. The application has been used successfully on Linux Mint 22.3 with a Sony MZ-N910. The new installer has been checked by package extraction and simulated installation scripts; a live system installation is not claimed by those checks.

The `.deb` extension does not mean every Debian-based distribution is supported. Older Ubuntu/Mint versions, Debian 12, ARM computers and Alpine do not meet this package's requirements. Other systems remain unverified.

## Install

1. Finish any recording. Close the old Platinum-MD Next window and other MiniDisc programs.
2. Download the `.deb`. Double-click it and use your system's package installer. Enter your administrator password when the installer asks.
3. Open **Platinum-MD Next** from your application menu.
4. Unplug and reconnect the recorder once so the installed USB rules take effect.

If double-click installation does not work, right-click the folder containing the download and choose **Open in Terminal**. Run:

```bash
sudo apt install ./Platinum-MD-Next-1.2.0-linux-amd64.deb
```

Use `apt install`, not archive extraction. It installs the desktop dependencies and registers the application. Start the app as your normal user, without `sudo` or sandbox-disabling options. Internet access may be needed for desktop dependencies from your distribution.

The same application profile is used as the earlier portable versions, so saved appearance settings, CD speed and album cache carry over. The recording queue is not saved between app sessions. Old extracted folders can be removed after the installed version is working; they do not have to be merged.

## Recording and removing the MiniDisc

Keep the recorder connected and powered until the app finishes recording. On the MZ-N910, after disconnecting, press the recorder's physical **STOP** button if the lid remains locked. Wait for **TOC Edit** to disappear before opening it. Do not remove power while disc information is being saved.

## CD reading speed

Use **Maximum** to let the CD reader request full drive speed. A number such as 24× is a request; the drive may limit or ignore it. Accurate extraction includes synchronization and error correction, and audio extraction can be slower than the drive's advertised data speed.

The app reads, encodes and transfers each track in sequence. Its status line shows which step is running. Diagnostics also preserve CD extraction, before/after disc checks and audio validation separately. This release does not claim an increased physical read speed. If reading remains unusually slow, save Diagnostics after a CD track rather than assuming the drive is faulty.

## Update or remove

Install 1.2.0 directly over any earlier 1.0 or alpha package. It replaces the app and refreshes the menu entry; no preliminary uninstall is needed. Saved appearance, CD speed and album information are kept. If the desktop temporarily shows a cached old icon, sign out and back in after saving your work.

Install a later `.deb` the same way. It replaces the installed app; no folder merging is required. Package-manager version `1:1.2.0` may be displayed: the leading `1:` ensures the 1.0 release sorts newer than the old 2.0 alpha packages. The app itself displays 1.2.0.

To remove the installed application:

```bash
sudo apt remove platinum-md-next
```

Your personal settings are left in your home directory. The application and its package-managed USB rule are removed. Unrelated rules you installed manually are left alone.

## Source and help

Use **Diagnostics → Save report** when reporting a problem. Reports may contain music titles and paths; review them before posting publicly.

The installed changelog is `/usr/share/doc/platinum-md-next/CHANGELOG.md`. The complete application Git history is `/usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle`. Native corresponding source and licenses are included under `/opt/Platinum-MD Next/resources/native/`.
