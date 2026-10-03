# Platinum-MD Next alpha.4

Historical guide. The current update is [alpha.5](ALPHA_5.md).

This update adds audio-CD transfer, Silver/Burgundy/Violet appearance choices, and a targeted change for the recording-session timeout seen in the multiple-song test. It is for the existing Intel/AMD 64-bit Mint 22 / Ubuntu 24.04 desktop test.

## Open the update

1. Close Platinum-MD Next and other MiniDisc apps. Let the recorder finish any TOC-writing message. Disconnect USB, wait for it to leave PC mode, then reconnect.
2. Keep your original **Platinum-MD-Next-2.0.0-alpha.2** folder in Downloads. This update reuses that download; you do not need the four large downloads again.
3. Extract **Platinum-MD-Next-2.0.0-alpha.4-update.zip** beside the original folder. Open the new **Platinum-MD-Next-2.0.0-alpha.4** folder, open a terminal there, and run:

   ```bash
   bash ./Start-Platinum-MD.sh
   ```

The launcher creates a separate updated app without a system installation or administrator password. Keep the terminal open while using the app. Check that the window shows **2.0.0-alpha.4**.

If the original download is not found, keep the two folders beside each other. The alpha.2 folder must contain its assembled `.deb`. If necessary, run its old launcher once with the original downloads available, close that app, then open alpha.4.

## CD to MiniDisc

1. Insert a music CD into the computer's internal or USB CD/DVD drive.
2. Click **Add audio CD**, choose the tracks, then **Add tracks to queue**. With several drives, choose the correct one from the list.
3. Edit song names or change their order in the queue if wanted. Choose **SP** for the first test, then **Record to MiniDisc** and confirm.

Keep the CD and recorder connected until recording finishes. The app reads one CD track at a time using the bundled cdparanoia reader, checks its format and length, then records it. It does not require a separate ripping application or a saved album folder. Temporary audio is removed at the end of the operation.

Initial names are “Track 01”, “Track 02”, etc.; automatic album lookup and CD-Text are not implemented. Standard stereo audio CDs are supported for testing. Pre-emphasis and four-channel tracks are explicitly unavailable. A data CD containing MP3/FLAC files can use **Add audio** instead. CD reading, drive permissions and sound quality still need checking on real hardware.

## One combined recording test

Use a spare, ungrouped MiniDisc with enough free space. Queue **three short tracks** and record the batch once in **SP**. If a CD drive is available, one of those tracks can come from **Add audio CD**; the others can be local files, including an MP3.

Check that the MiniDisc gained exactly three tracks with the expected order and lengths. Listen briefly through the recorder's headphones. Save **Diagnostics → Save report** after the test, whether it passes or fails. If anything fails, stop the test and save the report before reconnecting. Do not retry a track until you have checked whether it was recorded.

This single test checks the new batch behavior and can also check the CD path. LP2/LP4 hardware validation can follow after SP batches work reliably. Reports can contain music titles and local paths; review before sharing publicly.

## Appearance

Open **Appearance** for six palettes: **Walkman orange**, **Forest**, **Midnight blue**, **Silver**, **Burgundy**, and **Violet**. Each offers Light, Dark or Follow system. Your previous choice is preserved.

## What changed in recording

The latest alpha.3 report shows successful MP3 conversion and committed recordings, followed by a one-second USB polling timeout while closing the secure session. One failed two-track batch had actually recorded both tracks; another stopped after committing its first track. Reconnection allowed the listing to be read again.

Alpha.4 gives each close-session response a shared, bounded **20-second budget** across polling and reading. It does not resend audio or automatically retry a failed write. If a session still fails, both recording and Refresh ask for a USB reconnect before contacting that connection again. Explicitly committed tracks are removed from the queue to avoid duplicate recording.

Local protocol and application checks pass, including a simulated slow close that fails under alpha.3 and passes under alpha.4. This is a targeted fix to test, not proof that the recorder's underlying timeout is solved. Full Linux-distribution compatibility and a stable release remain future validation work.
