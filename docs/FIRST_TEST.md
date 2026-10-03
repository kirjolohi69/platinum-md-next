# First test on Linux Mint

This alpha targets Mint 22 / Ubuntu 24.04 on a 64-bit Intel/AMD computer. Start by checking that it can reliably read a disc. No code editing is required.

## 1. Run the connection test

Download `NetMD-Connection-Test-2.0.0-alpha.2-linux-x64.tar.gz`, right-click and choose **Extract Here**. Open the extracted **NetMD-Connection-Test-2.0.0-alpha.2** folder. Right-click an empty area, choose **Open in Terminal**, and paste:

```bash
bash ./Probe-NetMD.sh
```

Use your normal account. Close other MiniDisc applications and browser tabs using the recorder. Connect one recorder with a disc inserted and wait for its display to settle. The test reads disc information; it does not record, rename, delete or erase tracks.

It saves a `netmd-report-….txt` file in that folder, even when connection fails. Negotiation has a 45-second limit. Attach the report to the conversation where you are developing the fork. It can include disc titles and track names, so review it before posting publicly.

If USB access is available but the connection times out, do not reinstall USB rules or run as root. The report's final `stage:` line identifies where negotiation stopped. If needed, `bash ./Probe-NetMD.sh --trace` adds USB detail.

If access is actually blocked, ask an administrator to install the included device-specific rule once, from the extracted folder:

```bash
sudo install -m 644 packaging/linux/70-platinum-md-netmd.rules /usr/lib/udev/rules.d/70-platinum-md-next.rules
sudo udevadm control --reload-rules
```

Unplug and reconnect the recorder, then retry from your normal account. Rules grant access to the active local desktop user on matching NetMD hardware. Remote sessions and distributions without udev/logind may need a different setup.

This run should begin with `Platinum-MD Next connection test 2.0.0-alpha.2`. Its report will include the actual capacity response length.

## 2. Try the desktop alpha (after connection is confirmed)

The alpha.2 connection test has now successfully read 22 LP2 tracks on an MZ-N910. The Debian desktop package has been rebuilt with that same helper. For the split downloads supplied in this conversation, follow [the desktop-test guide](DESKTOP_TEST.md): extract the first ZIP, keep the remaining ZIP files beside it, and run `bash ./Start-Platinum-MD.sh` from the extracted folder. It checks the downloads and tries a normal-user launch without installing system files.

On Mint 22, download the `.deb` and double-click it to open the package installer. An administrator must approve installation. Launch **Platinum-MD Next** from the sound/video menu as your normal user. The installer includes the USB rule; reconnect the recorder after installation.

The previously built alpha.1 AppImage and desktop tar.gz do not include the capacity fix. Do not use them for this test. The `.deb` is the preferred installation path on Mint. Do not solve launch problems by disabling the Chromium sandbox or running as root.

Portable launch still requires compatible desktop libraries and sandbox support; it is not guaranteed to work on a restricted account. If launch fails, the desktop-test launcher saves a startup report for diagnosis.

First check that the track list matches the recorder, then try Play, Pause and Stop while listening through the recorder's output. The successfully tested disc is full and grouped. Keep it for read/playback checks; do not erase it to make space.

Desktop launch, selected-track playback, Stop and idle USB reconnection are now confirmed on the user's MZ-N910 setup. Follow [the first-recording guide](FIRST_RECORDING.md) next: use a spare blank disc, add the provided 30-second test WAV, select **SP**, and record one track. Listen on the recorder and check duration, title and channels. Only then try LP2/LP4 or editing operations on the spare disc. **Stop after this track** lets the active transfer finish before stopping the queue.

If something fails, stop and save the report from **Diagnostics**. Do not keep retrying a write whose result is uncertain. Reports identify failures but do not prove that an interrupted write left the disc unchanged.

## What to send back

- Distribution/version and package used.
- Recorder model and whether the disc was blank or already recorded.
- Diagnostic report and your last action.
- For audio tests: mode, whether the track plays, and whether title/duration match.

Hardware operation and desktop installation still need validation. This alpha should not yet replace a working setup for important discs.
