# First SP recording test

**Update:** before making another recording, use [alpha.3 and its SP/MP3 retest guide](ALPHA_3.md). The alpha.2 steps below document the original setup; its later recording-session failure is described in [known issues](KNOWN_ISSUES.md).

Use the existing **2.0.0-alpha.2** desktop app. No new app download is needed for this test.

This first SP test has now passed on the user's Sony MZ-N910: blank-disc reading, a new 30-second SP track, matching title/mode/duration, and reported successful playback. Session-closing warnings remain open. Keep this procedure for reproducing the SP test; the next hardware test is in `LP_RECORDING.md`.

## Prepare a spare blank disc

1. Stop playback. Disconnect USB, swap the full music disc for a **spare blank, recordable MiniDisc**, and reconnect USB after the recorder has settled.
2. Click **Refresh disc**. Check that the app shows **0 tracks**, some free space, and no grouped-disc warning. If it does not, save Diagnostics and report that before trying to record. Leave the original music disc intact.
3. Download **Platinum-SP-Test-30s.wav** from the conversation. This is an original 30-second, stereo, 44.1 kHz, 16-bit PCM WAV. The generator is `scripts/make-test-audio.py`; no existing song or recording is included.

## Record one track

1. Click **Add audio**, select the WAV, and leave only that file selected in the recording queue. Its title should be **Platinum-SP-Test-30s** and its duration **0:30**.
2. Choose **SP · Best quality**.
3. Click **Record to MiniDisc** and confirm. Keep the recorder connected and let the app finish. Do not unplug during conversion, recording or verification.
4. Check for exactly **one new track**, mode **SP**, the expected title, and a length of approximately **00:30**.
5. Select it and click **Play**. Listen through headphones connected to the recorder. The file plays soft notes on the **left for 10 seconds**, **right for 10 seconds**, then **both sides for 10 seconds**, with short gaps between notes. It should run at a normal, steady pace without noise or obvious distortion.

## Send the result

Use **Diagnostics → Save report** after the attempt. Attach it and say whether recording finished, whether the title/mode/length matched, and whether the channel sequence sounded correct. Reports can contain titles and local paths; review before sharing publicly.

If a write fails, leave the disc as it is and send the report. Do not immediately retry the write or delete anything: the recorder may have created a track even if verification failed.

The next tests after a successful SP recording are LP2 and LP4 recordings, listening with real music, and editing on this spare test disc. Keep those results separate from the already-confirmed playback of the pre-existing LP2 music disc.
