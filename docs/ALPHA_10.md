# Platinum-MD Next alpha.10

This revision corrects the empty-recorder check introduced in alpha.9. That fix was incomplete: the latest report still shows three failures during disc-presence checking, after successful USB open and interface claim. Ordinary disc reads succeed. Temporary Linux USB permissions recover normally in this report.

## Changes

- **Presence check:** follows the established NetMD rule that status payload byte 4 equals `0x40` when media is present. Alpha.9 incorrectly required the absent value to be zero. Other valid absence values now reach the **Insert a MiniDisc** state.
- **Descriptor commands:** a recorder declining an optional descriptor open/close command no longer invalidates a separately verified status response. USB transport failures, empty replies and malformed status responses still stop the check. Missing media never becomes a writable blank disc.
- **Useful diagnostics:** the read-only presence exchange now records separate open, status and close replies, bounded to 64 bytes each, plus the interpreted presence value or precise validation failure. Alpha.9 only recorded response length, so its report cannot distinguish which check rejected the recorder's response.

Recording, CD reading, album lookup and saved appearance settings keep their existing behavior.

## Start

Finish any recording and close the old app. Extract **Platinum-MD-Next-2.0.0-alpha.10-linux-x64.zip** into a fresh folder and run:

```bash
bash ./Start-Platinum-MD.sh
```

This is the complete application with its desktop runtime, native tools, corresponding source/licenses and source-history backup. No previous version or folder merging is needed. The target remains Linux Mint 22 / Ubuntu 24.04 x86_64 with glibc 2.39 or newer.

## Quick check

Connect the recorder without a MiniDisc. It should show **Insert a MiniDisc**. Insert a disc, close the lid and choose **Refresh disc**; its normal listing should return. If an error remains, export Diagnostics: the new status details should identify the exact remaining mismatch.

The protocol regressions and application tests pass, including tests that fail on alpha.9. Complete-ZIP extraction, helper startup, runtime startup in Node mode and embedded source checks are release gates. No graphical desktop or physical-recorder test ran in the build environment; the precise response bytes from your recorder are not in the alpha.9 report.
