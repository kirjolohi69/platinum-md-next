# Platinum-MD Next alpha.5

This update adds MusicBrainz album lookup to **Add audio CD**. It finds album and artist names and track titles, shows matching editions for review, and can name an empty MiniDisc after the album. It retains the recording helper successfully tested in alpha.4.

## Open the update

1. Close Platinum-MD Next and other MiniDisc applications.
2. Keep your original **Platinum-MD-Next-2.0.0-alpha.2** folder in Downloads. The update reuses its verified download.
3. Extract **Platinum-MD-Next-2.0.0-alpha.5-update.zip** beside that folder. Open the new **Platinum-MD-Next-2.0.0-alpha.5** folder, open a terminal there, and run:

   ```bash
   bash ./Start-Platinum-MD.sh
   ```

Check that the window shows **2.0.0-alpha.5**. No administrator password or new large download is needed. Keep the terminal open while using the app. If the original package cannot be found, the alpha.2 folder must still contain its assembled `.deb`; its original launcher can reassemble that download if its parts are still present.

## Album lookup

Insert an audio CD and choose **Add audio CD**. **Look up albums automatically with MusicBrainz** is enabled initially and can be turned off; the choice is remembered.

A single exact match is selected for preview. If several editions match, choose the correct **Album / edition**. Possible matches based on similar track lengths always require selection. Check the titles before adding tracks. Album and artist information appears in the queue; click a song title to edit it.

If your MiniDisc is empty and the selected tracks belong to one album, **Name this MiniDisc** offers an album title automatically. You can untick it. The title is included in the recording confirmation and is applied only after the whole selected batch finishes. Adding to a populated MiniDisc does not automatically rename it.

Only CD identifiers and track timings go to MusicBrainz, not your audio files or their local paths. Found albums are cached on this computer for offline reuse. **Look up album** requests a fresh result. A missing album, unavailable service or disconnected Internet does not prevent recording with manual titles. MusicBrainz does not cover every pressing; review its suggestions. Non-Latin titles still need recorder-compatible edits because this alpha uses basic Latin MiniDisc titles.

Existing album/artist tags in local audio files are also read, including uppercase FLAC-style tag names. The same empty-disc naming option works when all selected files belong to one tagged album. There is no online fingerprinting or retagging of local audio files.

## The next short test

1. Open **Add audio CD** with a known commercial CD and check that the album, artist and track names appear. Choose an edition if requested. Add a track and verify its name in the queue. On a spare empty MiniDisc, an SP recording can also check the optional album title.
2. Record one short track in **LP2**, then one in **LP4**, checking the displayed mode, title, duration and audible playback through the recorder. Stop if anything fails.
3. Save **Diagnostics → Save report** after this test, including on success. Reports may contain music titles and local paths.

The supplied alpha.4 report confirms a three-track local-file SP batch and a two-track CD/SP batch, with five successful commits/readbacks, clean session closes and 59 successful helper calls. The user confirms the recordings work. That is a strong result on this MZ-N910/Mint setup.

Alpha.5 passes 47 application tests and the production build. The Disc ID implementation matches MusicBrainz's published reference example. Live API access from the build environment returned an unavailable page, so a real online match is not claimed here. The new album-title workflow and LP2/LP4 listening still need your hardware check.

## Release direction

Freeze new features after this metadata update. Confirm lookup, LP2/LP4 and the remaining small recording/editing/recovery checks, build a full standalone installer, test installation on a clean supported Mint/Ubuntu desktop, then publish a clearly labelled prerelease. A stable release requires those checks to pass. Broad Linux support, Flatpak, other recorders and other architectures remain separate validation work; this alpha is not a universal Linux release.
