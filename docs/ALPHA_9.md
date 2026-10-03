# Platinum-MD Next alpha.9

This revision addresses connecting a recorder with no disc and a temporary USB permission warning that stayed visible even after access succeeded.

## Changes

- **Empty recorder:** a rejected disc-title request is followed by a read-only presence check. Only a valid response confirming absence becomes the calm **Insert a MiniDisc** state. Insert a disc, close the lid and choose **Refresh disc**. Missing media never becomes a blank, writable MiniDisc listing. USB failures and uncertain responses still produce errors.
- **USB connection:** a newly connected device gets up to six seconds for Linux to grant access. The app shows a waiting message during this time, then reports a persistent denial. Old connection warnings clear when connection succeeds or the recorder is unplugged. Recording failures remain separate and are not hidden by background reconnection.
- **Diagnostics and responsiveness:** repeated encoder spinners are reduced to occasional progress summaries. Actual output and errors remain available. Timings for the most recent 255 queued tracks are saved separately from the rolling helper log, including source type, audio duration, selected CD speed and per-stage outcome.

The screenshot's 2:42 track took about 47 seconds in the CD-reading step and 13 seconds encoding LP4: about 3.4× effective reading speed, including disc checks and audio validation. This identifies reading as the largest completed step shown, but does not distinguish drive limits from disc condition or error-correction work. The 24× choice is a request, not a measured speed. The earlier CD measurements had already been displaced by encoder progress in the attached reports; this revision preserves those measurements for future diagnosis.

## Start

Finish any current recording and close the old app. Extract **Platinum-MD-Next-2.0.0-alpha.9-linux-x64.zip** into a fresh folder, open a terminal there and run:

```bash
bash ./Start-Platinum-MD.sh
```

This ZIP contains the complete app, desktop runtime, native tools, matching source/licenses and source-history backup. No previous folders or downloads are needed. See [the portable guide](PORTABLE.md).

## Check on your recorder

Connect without a MiniDisc: the app should ask you to insert one. Insert a disc, close the lid and choose **Refresh disc**; its track list should appear. A brief wait for USB access should resolve automatically. If an error persists or CD reading is still slow, **Diagnostics → Save report** now retains the useful timings.

All 66 application tests and 71 native protocol cases pass. Native tests cover confirmed presence/absence, malformed replies and transport/descriptor failures; application tests cover the observed permission transition, persistent denials, refresh after inserting a disc, and stopping edits when a disc disappears. The rebuilt helper is produced from the packaged pinned source and patch. The complete ZIP also passes extraction, integrity, helper/runtime-startup and source-history checks. No physical recorder/CD-speed or graphical desktop test ran in this environment. CD error correction, audio encoding and transfer formats are unchanged.

This remains a Mint 22 / Ubuntu 24.04 x64 preview. LP2/LP4 listening, full-CD completion and clean-system installation remain release checks.
