# Platinum-MD Next alpha.7

This revision fixes the remaining MusicBrainz HTTP 400 error in alpha.6. The detailed report identifies the explicit `discids` include option as the rejected value. MusicBrainz's DiscID controller automatically includes media and disc IDs; its accepted options include `recordings` and `artist-credits`, but neither `discids` nor `releases`. Alpha.7 requests only `recordings artist-credits`, keeping alpha.6's corrected URL encoding.

The regression now uses the endpoint's own include rules and automatic fields, with source provenance recorded in the test fixture. It reproduces alpha.6's exact rejection, rejects both earlier malformed requests and the tempting addition of `releases`, then checks that the corrected lookup still returns exact matches, album artists and track names. This replaces the incomplete release-style contract used in alpha.6's test.

## Start

Close the old app and extract **Platinum-MD-Next-2.0.0-alpha.7-linux-x64.zip** into a fresh folder. Open a terminal in the extracted folder and run:

```bash
bash ./Start-Platinum-MD.sh
```

Every revision is a complete ZIP with the runtime, native tools, matching source/licenses and a Git source backup. No earlier download or folder merging is needed. See [the portable guide](PORTABLE.md).

## Check lookup

Open **Add audio CD** with the same CD. Automatic lookup runs if enabled; otherwise choose **Look up album**. Check the album and track names, selecting an edition if offered. No recording is needed. If an error remains, save **Diagnostics → Save report**.

The endpoint rules and regression are verified from MusicBrainz's actual source. A live MusicBrainz match is not verified in this build environment. Recording, CD extraction, audio encoding, appearance and user preferences are unchanged. This remains a Mint/Ubuntu x64 preview; LP2/LP4 listening and clean-system installation remain release checks.
