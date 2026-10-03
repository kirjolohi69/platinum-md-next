**Platinum-MD Next’s modernization is 100% vibe-coded, first with ChatGPT (GPT-6 Astra) and now with Claude (Anthropic).**

# Platinum-MD Next

A Linux desktop application for recording music to NetMD MiniDisc recorders, based on [Platinum-MD by Gavin Benda](https://github.com/gavinbenda/platinum-md). The original project and bundled third-party tools retain their own authorship and licenses. This is an independent community fork, not an official Sony or upstream release.

## Download and install

**Version 1.1.0.** The main download is **Platinum-MD-Next-1.1.0-linux-amd64.deb**, for **Linux Mint 22 / Ubuntu 24.04 on Intel or AMD 64-bit computers**.

<!-- download-start -->

[Download the .deb installer](https://github.com/kirjolohi69/platinum-md-next/releases/latest).

<!-- download-end -->

Close the old app, double-click the `.deb` and install it. Open **Platinum-MD Next** from your application menu, then reconnect the recorder once. There is no folder merging or separate converter installation.

If you prefer the terminal, open it in the download folder and run:

```bash
sudo apt install ./Platinum-MD-Next-1.1.0-linux-amd64.deb
```

Run the application as your normal user. The installer includes the desktop runtime, NetMD helper, audio converters, CD reader, device-specific USB rules, source and licenses. It upgrades earlier 2.0 alpha packages; the app now uses the requested 1.0 release numbering.

See the [installation guide](docs/INSTALL.md) for upgrades, removal and requirements. These binaries require glibc 2.39 or newer and normal desktop sandbox support. They are not universal Linux packages: older Ubuntu/Mint, Debian 12, ARM and Alpine are not supported by this download. Flatpak and other package formats are future work.

## Features

- Record audio files and audio CDs in SP, LP2 or LP4.
- Look up CD album and track names through MusicBrainz, with saved results available offline.
- Drag audio files onto the queue, edit titles and arrange the recording queue; optionally name an empty MiniDisc after the album.
- Read disc information, rename tracks, manage tracks on ungrouped discs and control recorder playback.
- Choose eight saved appearance palettes: orange, red, yellow, forest, blue, silver, burgundy and violet. Each supports light, dark and system brightness.
- Request CD read speeds from 1× to 48× or Maximum. Error correction stays enabled; actual speed depends on the drive and disc.
- View recording stages and export diagnostics with separate CD reading, encoding and MiniDisc transfer timings.

Playback controls play through the recorder's audio output. When a recording finishes, keep power connected while the recorder saves disc information. On the MZ-N910, if the lid stays locked after disconnecting, press its physical **STOP** button and wait for **TOC Edit** to disappear before opening it.

CD reading, encoding and transfer happen in sequence for each track. This release adds more precise reading diagnostics, without claiming faster extraction. Choose Maximum to request full drive speed.

## Tested scope and limits

The app has been used successfully on **Linux Mint 22.3 with a Sony MZ-N910**. The author has confirmed playback, reconnection, empty-recorder handling, local-file and CD recording, working album lookup, and LP2/LP4 listening. The latest hardware report contains five successful local-file transfers with clean commit, session close, release and readback. See [validation](docs/VALIDATION.md) and the [changelog](docs/CHANGELOG.md).

The new `.deb` is checked by extraction, integrity verification, bundled-tool startup and isolated installer-script simulations. Electron startup could not be completed in the current build workspace and is not counted as passed. These are not a live installation or graphical launch on a second computer. Other distributions and recorder models remain unverified.

Hi-MD, audio extraction from MiniDisc, group editing, Windows/macOS builds and automatic updates are not included. Recording, deletion, movement and disc renaming remain blocked on grouped discs to preserve their metadata. Recorder titles use basic Latin characters; accents are simplified. Pre-emphasis and four-channel CDs are not supported. LP2/LP4 use the open-source ATRAC encoder.

Online lookup is optional. The main process contacts MusicBrainz over HTTPS with CD timing information, not audio files. The queue remains usable without an internet connection. Read [metadata behavior](docs/CD_METADATA.md).

## Build from source

Use Ubuntu 24.04 x86_64 and Node.js 24. Install build prerequisites once:

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake pkg-config git python3 libusb-1.0-0-dev libgcrypt20-dev libjson-c-dev
```

From a clean, committed Git checkout, as a normal user:

```bash
npm ci
npm test
npm run native
npm run test:native
npm run test:audio
npm run package:deb
npm run test:deb
```

The `.deb` is written to `release/`. The first native build downloads and compiles pinned dependencies and can take a while. Keep `.cache/` for faster rebuilds. The packaging check requires committed source so the embedded Git backup matches the application. `npm run dev` opens the app after native tools are built.

The desktop app lives in `app/` (Electron main process) and `ui/` (Vue interface). The original project's Electron-Vue code was removed after the rewrite; it remains available in [the upstream repository](https://github.com/gavinbenda/platinum-md). [The original README](docs/UPSTREAM_README.md) is kept for reference.

The application uses a sandboxed, isolated renderer with a small preload bridge. USB and audio work run through bundled helpers. Native source pins, patches, licenses and build instructions are included in each package. This modernization is not a complete protocol rewrite or security audit.

## Releases

GitHub Actions builds and checks the `.deb` on every push. Maintainers publish releases by following the [release guide](docs/PUBLISHING.md). Changes between versions are listed in the [changelog](docs/CHANGELOG.md).

## License and credits

Application: MIT, preserving Gavin Benda's original copyright and artwork attribution. Native programs retain their component licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE](LICENSE), and the matching native source and licenses included in binary packages.
