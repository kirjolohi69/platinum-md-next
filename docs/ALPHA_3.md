# Platinum-MD Next alpha.3

Historical guide. The current update is [alpha.4](ALPHA_4.md).

This update adds the orange recorder theme and appearance choices, and corrects recording error handling found in the alpha.2 MP3 test. It is for the existing Intel/AMD 64-bit Mint 22 / Ubuntu 24.04 desktop test.

## Open the update

1. Close Platinum-MD Next and other MiniDisc applications. Once the recorder is idle and has finished any TOC-writing message, disconnect USB. Wait for it to leave PC mode, then reconnect it.
2. Keep your original **Platinum-MD-Next-2.0.0-alpha.2** folder in Downloads. The new launcher reuses its verified download, so you do not need the four large downloads again.
3. Download **Platinum-MD-Next-2.0.0-alpha.3-update.zip** and extract it beside that original folder. Open the new **Platinum-MD-Next-2.0.0-alpha.3** folder.
4. Open a terminal in the new folder and run:

   ```bash
   bash ./Start-Platinum-MD.sh
   ```

The launcher prepares a separate copy of the app in the new folder. No administrator password or system installation is needed. Keep the terminal open while using the app. Check that the app shows **2.0.0-alpha.3**; close any older window before testing.

If the launcher cannot find the original download, check that the two folders are beside each other. The original alpha.2 folder should still contain its assembled `.deb` file. If you removed it, run the old launcher once with its original downloads available to assemble it again, close that app, and retry the new launcher.

## Choose the look

Click **Appearance** near Diagnostics. Choose **Walkman orange**, **Forest**, or **Midnight blue**, then **Follow system**, **Light**, or **Dark**. The whole interface changes immediately and remembers your choice. **Reset appearance** returns to orange and Follow system.

The orange palette uses copper, silver and a muted green LCD colour inspired by the MZ-N910. All six palette/brightness combinations have checked text contrast. The updated UI builds successfully; its appearance and persistence still need confirmation in your desktop session.

## Retest recording

Use the spare test disc. Your last report showed that you deleted the original 30-second SP test before trying the MP3; a later successful disc read was not captured.

1. Let the recorder and track listing appear. If anything unexpected appears, save Diagnostics and share it before continuing. There is no need to erase the disc.
2. Add **Platinum-SP-Test-30s.wav**, select **SP**, and record just that one track. Wait for the refreshed listing. Check the title, SP mode and approximately 30-second length, then listen through headphones connected to the recorder.
3. If that succeeds, keep the same app session open, add the MP3 that previously failed, and record just that file in **SP**. Check its title and duration, and listen briefly on the recorder. This also checks whether a second recording can start after the first session closes.
4. Save **Diagnostics → Save report** after the test, including if both tracks work. If recording or the refreshed listing fails, stop there and save the report before reconnecting or trying another recording.

Keep LP2/LP4 and longer queues for the next step after these results. Reports can contain music titles and local file paths; review them before sharing publicly.

## What the recording change does

The MP3 was imported and converted successfully in alpha.2. The failure occurred during USB recording-session setup, before the log showed an audio bulk transfer. The old helper continued after setup failures and sometimes treated a negative USB result as a large response length.

Alpha.3 stops at failed setup and incomplete transfers, checks actual USB byte counts, waits for recorder readiness around session transitions, and reports transport errors accurately. Disc headers are read once and used for both group counting and parsing; a failed header read cannot become an apparently ungrouped disc. Cleanup releases packet memory safely and reports a completed commit separately from a later cleanup failure.

The app stops the queue after a helper failure and requires USB reconnection before another recording attempt in that app session. If the helper explicitly confirmed the commit, the completed item is removed from the queue even when cleanup fails. There is no automatic recording retry.

Local checks pass: 48 native protocol/lifecycle cases, 18 application tests, production UI build, and native helper dependency/startup checks. These checks do **not** establish that the MZ-N910's underlying USB timeout has been eliminated. The hardware retest above is still required.

This remains an alpha for the tested Mint setup, not a release claiming compatibility with every Linux distribution. The original alpha.2 files retain their original hashes.
