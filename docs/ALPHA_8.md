# Platinum-MD Next alpha.8

CD reading speed can now be selected under **Recording quality** whenever the queue contains CD tracks. Choices are **Maximum (default)**, **1×**, **2×**, **4×**, **8×**, **16×**, **24×**, **32×** and **48×**. The choice is saved between sessions and applies to all CD tracks in the next recording batch. Settings are locked while a batch is running.

These are requested drive speeds. A drive can limit or ignore a request. Maximum preserves the previous reader behavior, which already requested full drive speed. CD error correction, stopping on uncorrectable skips, CD-change checks and extracted-audio validation remain enabled at every speed. A lower speed may be useful for a difficult disc; no speed increase is guaranteed.

The status now distinguishes **Reading CD**, **Encoding LP2/LP4**, **Sending to MiniDisc** and the disc checks. Previously LP encoding incorrectly kept the CD-reading or file-conversion label on screen. Each step has an elapsed timer; completed reading/encoding times remain visible during later steps of that track. Diagnostics record each stage's duration and whether it succeeded, plus the requested CD speed. CD-reading timing includes its disc checks and WAV validation.

The drive speed setting affects CD reading only. It cannot accelerate ATRAC encoding or USB recording. The new timings help identify which part is slow without guessing from the old label.

## Start

Let your current recording finish before closing the old app. Extract **Platinum-MD-Next-2.0.0-alpha.8-linux-x64.zip** into a fresh folder, open a terminal there and run:

```bash
bash ./Start-Platinum-MD.sh
```

This is a complete ZIP with the runtime, native tools, matching source/licenses and a Git source backup. No earlier folders or downloads are needed. See [the portable guide](PORTABLE.md).

## Try the control

Add CD tracks, choose **CD read speed** below Recording quality, then record as usual. The choice takes effect when reading the next batch. If it still seems slow, the status shows which step is taking time; **Diagnostics → Save report** includes the measurements. Listen to recorded LP2/LP4 audio on the recorder to check the result.

All 56 application tests and the production UI build pass. Tests cover every allowed speed, invalid requests, remembered preferences, multi-track LP2/LP4 staging, and stopping after read/encoding/USB errors without duplicating committed tracks. The complete ZIP also passes extraction, file-integrity, helper/runtime-startup and source-history checks. This build environment has no physical CD drive or recorder, so the effect of speed selection on a particular drive still needs a hardware check. No GUI test ran here.

The user has confirmed that alpha.7 album lookup works. This remains a Mint 22 / Ubuntu 24.04 x64 preview; full-CD completion, LP2/LP4 listening and clean-system installation remain release checks.
