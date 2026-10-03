# Platinum-MD Next: desktop test

**Update:** before making another recording, use [alpha.3 and its SP/MP3 retest guide](ALPHA_3.md). The alpha.2 steps below document the original setup; its later recording-session failure is described in [known issues](KNOWN_ISSUES.md).

Version **2.0.0-alpha.2**, for **Linux Mint 22 / Ubuntu 24.04 on Intel/AMD 64-bit computers**.

The MZ-N910 connection test successfully read all 22 LP2 tracks. The user has now also confirmed desktop launch, playback, USB reconnection and a first 30-second SP recording on a spare blank disc. Session-closing warnings remain open in `KNOWN_ISSUES.md`. The next individual recording tests are described in `LP_RECORDING.md`. No new app download is needed.

## Open the desktop

1. Download **all four numbered ZIP files into the same Downloads folder**. Keep their filenames unchanged.
2. Right-click **Platinum-MD-Next-2.0.0-alpha.2-part-1-of-4.zip** and choose **Extract Here**. Leave parts 2–4 as ZIP files alongside the first ZIP.
3. Open the extracted **Platinum-MD-Next-2.0.0-alpha.2** folder. Right-click an empty area and choose **Open in Terminal**.
4. Run this command from your normal account:

```bash
bash ./Start-Platinum-MD.sh
```

The launcher checks all four downloads, reconstructs the complete `.deb`, and unpacks the application into its own `desktop` folder. It then opens the app. Allow a minute for the first unpacking and keep the terminal open while the app runs. Use the same command next time; it reuses the unpacked files. Allow at least 1 GB of free space. You do not need Node.js, npm or a compiler.

This route uses Python 3 and `dpkg-deb`, included with Mint/Ubuntu. It does not install packages, change USB permissions or bypass the Electron sandbox. The split downloads work around the failed transfer of the full installer in this conversation; they are a temporary test format. A GitHub release should offer the ordinary single-file packages.

## Check the track list and playback

Close other MiniDisc apps and browser tabs using the recorder. Connect only the MZ-N910, with the tested disc inserted.

Check that the app shows version **2.0.0-alpha.2**, **22 tracks**, **LP2** modes, sensible titles and lengths, and no connection error. The disc reports no free space and contains groups. The Record button should be disabled with an explanation.

Select one track and click **Play**, then **Pause** and **Stop**. Listen through the recorder's headphone/line output; playback does not stream audio through the computer. These controls do not record or edit tracks. Leave title editing and other writes for a later test on a spare disc.

Use **Diagnostics → Save report** and send it back with whether the window opened, the list was correct and playback worked. Reports can include music titles and local paths; review them before posting publicly. Do not erase the full disc to make room. Use a spare blank disc when recording tests begin.

## If the window does not open

The launcher saves a **desktop-start-report-….txt** file in the extracted folder. Attach it, along with the terminal output. If a missing or damaged download is reported before launch, download that named part again and retry.

Portable Electron applications may be blocked by Mint/Ubuntu's sandbox policy. If the report identifies this, an administrator can install the reconstructed **Platinum-MD-Next-2.0.0-alpha.2-linux-amd64.deb** by opening it in the package installer. That package includes the desktop entry, sandbox profile and NetMD USB rule. Launch the installed application from the menu as your normal user. Do not run the application with sudo or add sandbox-disabling flags.

The standalone USB test already confirmed access on this computer. A desktop launch problem does not by itself mean USB rules need reinstalling.

## Current limits

This remains an alpha. One successful disc read does not establish recording reliability or compatibility with all recorders or Linux distributions. Desktop launch has not been verified in the build environment. Flatpak remains experimental, and no GitHub repository or release has been published for this fork.
