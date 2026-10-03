# Platinum-MD Next 1.0.0

The first numbered release of the modern Linux fork. The principal download is the complete **Linux amd64 `.deb` installer**, targeting Linux Mint 22 / Ubuntu 24.04. Earlier 2.0 alpha numbers were development labels; the Debian package uses an epoch so installing 1.0 upgrades those previews correctly.

## Included

- Audio files and audio CDs to MiniDisc in SP, LP2 and LP4.
- MusicBrainz album and track lookup, editable recording queue, recorder playback and track management.
- Eight appearance palettes, now including red and yellow, with light, dark and system brightness. The header tagline has been removed.
- Saved CD speed requests and diagnostics separating extraction, disc checks, audio validation, encoding and transfer.
- Empty-recorder handling and recovery from temporary USB permissions.
- A recording-complete reminder for the recorder's physical STOP button and TOC writing.
- A menu launcher, device-specific USB rules, native tools, desktop runtime, source backup and licenses in one `.deb`.

## Tested scope

The user has confirmed normal operation on Linux Mint 22.3, Sony MZ-N910: device discovery/reconnection, empty-recorder handling, playback, local-file and CD recording, album lookup, and listening to LP2/LP4 recordings. The latest report records five successful local-file transfers (one SP, one LP2, three LP4), including commit, session close, release and readback. STOP clears the recorder's lid lock. The hardware-reported absent-media flag is `0x80`, now correctly handled.

The new Debian package is checked for complete contents, root ownership, valid installation scripts, clean extraction, bundled helper startup, runtime startup in Node mode, and matching application/native source. Those checks do not claim a live installation or graphical launch of this installer on a second machine. Other distributions and recorder models remain unverified.

## Known limits

CD reading remains drive- and disc-dependent; no extraction-speed improvement is claimed. The reader keeps error correction enabled. Each track is read, encoded and transferred in sequence. There is no Hi-MD support, MiniDisc audio extraction, group editing, Windows/macOS build, automatic updater or tested Flatpak. Grouped-disc write restrictions remain. Recorder titles use basic Latin characters; accents are simplified.

See [installation instructions](INSTALL.md) and [GitHub publishing guide](PUBLISHING.md). The modernization is 100% vibe-coded with GPT-6 Astra; upstream work and third-party tools retain their original authorship and licenses.
