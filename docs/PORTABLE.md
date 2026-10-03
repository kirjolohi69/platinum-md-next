# Platinum-MD Next — extract and run

Every revision is a complete ZIP containing the desktop runtime, NetMD helper, audio converters, CD reader, and source backup. No older version or download is needed.

1. Close the old app and other MiniDisc applications.
2. Extract the whole ZIP into a fresh folder in your home directory, for example Downloads. Keep its contents together.
3. Open the extracted folder. Right-click an empty area, choose **Open in Terminal**, and run:

   ```bash
   bash ./Start-Platinum-MD.sh
   ```

Keep the terminal open while using the app. No administrator password or extra runtime download is needed on the supported Mint/Ubuntu desktop. For each later revision, download its complete ZIP and repeat with a fresh folder; do not merge versions.

The app uses the same user profile for appearance preferences, CD read speed and cached album lookups. The current recording queue is not a saved playlist; finish it before closing the app.

This build targets **Linux Mint 22 / Ubuntu 24.04, Intel/AMD x64**. It uses the desktop's Python 3, glibc 2.39 or newer, desktop libraries and enabled Electron sandbox. It does not require FUSE or a Debian package extractor. Other distributions, ARM, 32-bit and Alpine remain unsupported by this preview. Your existing recorder/CD-drive permissions continue to apply; the launcher does not change system settings. Run as your normal user, without sudo or sandbox overrides.

If a file is missing or damaged, extract the ZIP into a fresh folder. `bash ./Start-Platinum-MD.sh --check` checks all files without opening the app. A failed launch leaves a `startup-report-*.txt` file whose location is printed in the terminal. For an in-app problem, use **Diagnostics → Save report**. Review reports before sharing; they may contain music titles and paths.

The `source/Platinum-MD-Next.bundle` file contains the application source and Git history. A developer can restore it with `git clone Platinum-MD-Next.bundle platinum-md-next`. Native source, build instructions and licenses are under `app/resources/native/`. No GitHub publication is performed by creating this ZIP.
