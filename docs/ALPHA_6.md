# Platinum-MD Next alpha.6

This revision fixes the album-lookup request in alpha.5. Literal plus signs were passed to the URL encoder, which sent `%2B` rather than the separators MusicBrainz documents. The user's diagnostics show HTTP 400 responses after successful CD reads. Alpha.6 sends correctly encoded include parameters.

Rejected requests, refused access and service errors now have distinct messages. Diagnostics retain the HTTP status and up to 512 characters of a bounded JSON service explanation. Error responses remain subject to a size cap and deadline; raw HTML is not displayed. Recording remains available if metadata cannot be retrieved.

## Start

Extract **Platinum-MD-Next-2.0.0-alpha.6-linux-x64.zip** into a fresh folder. Close the old app, open a terminal inside the new folder and run:

```bash
bash ./Start-Platinum-MD.sh
```

The complete ZIP contains the runtime, native tools, their source/licenses and the application source backup. It needs no older download. See [the portable guide](PORTABLE.md).

## Check the fix

Open **Add audio CD** with the same CD. Album lookup runs automatically if enabled; otherwise choose **Look up album**. Check the album, artist and track titles, selecting an edition if requested. You do not need to record anything for this check. If it fails, save **Diagnostics → Save report**; it now gives the specific HTTP error and service explanation when available.

The regression reproduces the old serialized request and verifies the corrected request through the HTTP client against the documented query contract. The build environment still receives an unavailable HTML page from the public API, so a successful live album match is not claimed here. Some CDs may have no database entry.

Native recording code, CD extraction, audio encoding and appearance are unchanged from alpha.5. LP2/LP4 listening, live metadata confirmation and clean-system installation remain release checks. This is a private Mint/Ubuntu x64 preview; no public GitHub release or universal Linux support is claimed.
