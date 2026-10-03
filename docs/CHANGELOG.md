# Changelog

Newest first. Alpha versions were private test builds numbered 2.0.0-alpha.N; the first public numbering is 1.0.

## 1.2.0

- **Record onto discs with groups.** New tracks are added after the last track, outside the existing groups, just as when recording on the recorder itself. After each track the app checks that the disc title and groups are unchanged, and stops the queue if they are not.
- **Edit discs with groups.** Groups are shown in the track list. Deleting and moving tracks and renaming the disc now work on grouped discs: the app updates the group information after every change and reads it back to check it. A group left without tracks is removed, after asking. The previous group information is kept in Diagnostics.
- Discs whose group information the app cannot read safely (for example names with accented characters) stay protected, with an explanation.
- **More reliable group updates.** If the recorder is still busy after a change, the app waits and tries once more, but only when the helper confirms nothing was sent the first time. If a group update still could not finish, a **Repair groups** button shortens groups that run past the last track, after showing what will change.
- **Fixes moving tracks.** The recorder helper sent each move request twice, so moving a track also moved whichever track took its place (seen on an MZ-N910: moving track 11 to 16 moved tracks 11 and 12 to the end). Each move is now sent once.
- A full MiniDisc is easier to spot: the record button reads **Disc full** and the free-space line turns red.
- Releases no longer include the old NetMD connection-test download.
- **Fixes the app missing from the menu after upgrading** from an early test version. The installer kept that version's owner-only folder permissions, so other user accounts could not open the app and the menu hid it. Installing 1.2.0 repairs the permissions.

## 1.1.0

- **Drag and drop:** drop audio files onto the recording queue instead of using **+ Add audio**. Dropping a folder explains that only files can be added.
- **Album order:** files from one album that carry track-number tags are queued in disc and track order, whatever order they were chosen or dropped in. Mixed selections keep their order.
- **Album title after Stop:** pressing **Stop after this track** during the last track of a batch no longer skips naming an empty MiniDisc after the album, because every track was recorded.
- **Project cleanup:** the original Electron-Vue code, old Windows/macOS helper binaries, alpha test-download scripts and the Forgejo publishing path were removed. The alpha notes are combined in `CHANGELOG.md`. Project links, the MusicBrainz contact and the release guide now point to the GitHub repository, and GitHub Actions attaches the installer to each published release.
- The license keeps Gavin Benda's original copyright notice alongside the fork's.

NetMD recording, CD reading and the native helpers are unchanged from 1.0.1. Install the complete `.deb` over the previous version; settings are kept.

## 1.0.1

- Fixes the installed application's owner-only folder permissions, which could hide the launcher and block normal-user startup. The installer now sets the application folder to 0755. Package checks cover normal-user access to every payload directory and file.
- Uses the same Walkman-orange disc symbol for the launcher and application window, replacing the teal MD icon. Orange SVG and matching PNG assets are included in the source.
- Adds a host-independent publishing setup and a Forgejo guide. Codeberg eligibility should be confirmed first because of its announced policy on heavily AI-written projects.

Install the complete `.deb` over 1.0.0; it upgrades the existing package. Finish recording and close the app before upgrading. Saved appearance, CD speed and album cache use the same profile.

The 1.0 source was restored from its embedded Git backup. NetMD, CD reading and audio-encoding code and native helpers are unchanged. Testing covers application regressions, UI build, package contents and permission modes, matching icons, native helper starts and isolated installer scripts. Electron startup could not be completed in this workspace and is not counted as passed. No new graphical desktop or physical-recorder test is claimed.

See [installation](INSTALL.md) and [publishing](PUBLISHING.md). The AI disclosure and upstream credits remain in the README.

## 1.0.0

The first numbered release of the modern Linux fork. The principal download is the complete **Linux amd64 `.deb` installer**, targeting Linux Mint 22 / Ubuntu 24.04. Earlier 2.0 alpha numbers were development labels; the Debian package uses an epoch so installing 1.0 upgrades those previews correctly.

### Included

- Audio files and audio CDs to MiniDisc in SP, LP2 and LP4.
- MusicBrainz album and track lookup, editable recording queue, recorder playback and track management.
- Eight appearance palettes, now including red and yellow, with light, dark and system brightness. The header tagline has been removed.
- Saved CD speed requests and diagnostics separating extraction, disc checks, audio validation, encoding and transfer.
- Empty-recorder handling and recovery from temporary USB permissions.
- A recording-complete reminder for the recorder's physical STOP button and TOC writing.
- A menu launcher, device-specific USB rules, native tools, desktop runtime, source backup and licenses in one `.deb`.

### Tested scope

The user has confirmed normal operation on Linux Mint 22.3, Sony MZ-N910: device discovery/reconnection, empty-recorder handling, playback, local-file and CD recording, album lookup, and listening to LP2/LP4 recordings. The latest report records five successful local-file transfers (one SP, one LP2, three LP4), including commit, session close, release and readback. STOP clears the recorder's lid lock. The hardware-reported absent-media flag is `0x80`, now correctly handled.

The new Debian package is checked for complete contents, root ownership, valid installation scripts, clean extraction, bundled helper startup, runtime startup in Node mode, and matching application/native source. Those checks do not claim a live installation or graphical launch of this installer on a second machine. Other distributions and recorder models remain unverified.

### Known limits

CD reading remains drive- and disc-dependent; no extraction-speed improvement is claimed. The reader keeps error correction enabled. Each track is read, encoded and transferred in sequence. There is no Hi-MD support, MiniDisc audio extraction, group editing, Windows/macOS build, automatic updater or tested Flatpak. Grouped-disc write restrictions remain. Recorder titles use basic Latin characters; accents are simplified.

See [installation instructions](INSTALL.md) and [GitHub publishing guide](PUBLISHING.md). The modernization is 100% vibe-coded with GPT-6 Astra; upstream work and third-party tools retain their original authorship and licenses.

## 2.0.0-alpha.10

This revision corrects the empty-recorder check introduced in alpha.9. That fix was incomplete: the latest report still shows three failures during disc-presence checking, after successful USB open and interface claim. Ordinary disc reads succeed. Temporary Linux USB permissions recover normally in this report.

### Changes

- **Presence check:** follows the established NetMD rule that status payload byte 4 equals `0x40` when media is present. Alpha.9 incorrectly required the absent value to be zero. Other valid absence values now reach the **Insert a MiniDisc** state.
- **Descriptor commands:** a recorder declining an optional descriptor open/close command no longer invalidates a separately verified status response. USB transport failures, empty replies and malformed status responses still stop the check. Missing media never becomes a writable blank disc.
- **Useful diagnostics:** the read-only presence exchange now records separate open, status and close replies, bounded to 64 bytes each, plus the interpreted presence value or precise validation failure. Alpha.9 only recorded response length, so its report cannot distinguish which check rejected the recorder's response.

Recording, CD reading, album lookup and saved appearance settings keep their existing behavior.

## 2.0.0-alpha.9

This revision addresses connecting a recorder with no disc and a temporary USB permission warning that stayed visible even after access succeeded.

### Changes

- **Empty recorder:** a rejected disc-title request is followed by a read-only presence check. Only a valid response confirming absence becomes the calm **Insert a MiniDisc** state. Insert a disc, close the lid and choose **Refresh disc**. Missing media never becomes a blank, writable MiniDisc listing. USB failures and uncertain responses still produce errors.
- **USB connection:** a newly connected device gets up to six seconds for Linux to grant access. The app shows a waiting message during this time, then reports a persistent denial. Old connection warnings clear when connection succeeds or the recorder is unplugged. Recording failures remain separate and are not hidden by background reconnection.
- **Diagnostics and responsiveness:** repeated encoder spinners are reduced to occasional progress summaries. Actual output and errors remain available. Timings for the most recent 255 queued tracks are saved separately from the rolling helper log, including source type, audio duration, selected CD speed and per-stage outcome.

The screenshot's 2:42 track took about 47 seconds in the CD-reading step and 13 seconds encoding LP4: about 3.4× effective reading speed, including disc checks and audio validation. This identifies reading as the largest completed step shown, but does not distinguish drive limits from disc condition or error-correction work. The 24× choice is a request, not a measured speed. The earlier CD measurements had already been displaced by encoder progress in the attached reports; this revision preserves those measurements for future diagnosis.

## 2.0.0-alpha.8

CD reading speed can now be selected under **Recording quality** whenever the queue contains CD tracks. Choices are **Maximum (default)**, **1×**, **2×**, **4×**, **8×**, **16×**, **24×**, **32×** and **48×**. The choice is saved between sessions and applies to all CD tracks in the next recording batch. Settings are locked while a batch is running.

These are requested drive speeds. A drive can limit or ignore a request. Maximum preserves the previous reader behavior, which already requested full drive speed. CD error correction, stopping on uncorrectable skips, CD-change checks and extracted-audio validation remain enabled at every speed. A lower speed may be useful for a difficult disc; no speed increase is guaranteed.

The status now distinguishes **Reading CD**, **Encoding LP2/LP4**, **Sending to MiniDisc** and the disc checks. Previously LP encoding incorrectly kept the CD-reading or file-conversion label on screen. Each step has an elapsed timer; completed reading/encoding times remain visible during later steps of that track. Diagnostics record each stage's duration and whether it succeeded, plus the requested CD speed. CD-reading timing includes its disc checks and WAV validation.

The drive speed setting affects CD reading only. It cannot accelerate ATRAC encoding or USB recording. The new timings help identify which part is slow without guessing from the old label.

## 2.0.0-alpha.7

This revision fixes the remaining MusicBrainz HTTP 400 error in alpha.6. The detailed report identifies the explicit `discids` include option as the rejected value. MusicBrainz's DiscID controller automatically includes media and disc IDs; its accepted options include `recordings` and `artist-credits`, but neither `discids` nor `releases`. Alpha.7 requests only `recordings artist-credits`, keeping alpha.6's corrected URL encoding.

The regression now uses the endpoint's own include rules and automatic fields, with source provenance recorded in the test fixture. It reproduces alpha.6's exact rejection, rejects both earlier malformed requests and the tempting addition of `releases`, then checks that the corrected lookup still returns exact matches, album artists and track names. This replaces the incomplete release-style contract used in alpha.6's test.

## 2.0.0-alpha.6

This revision fixes the album-lookup request in alpha.5. Literal plus signs were passed to the URL encoder, which sent `%2B` rather than the separators MusicBrainz documents. The user's diagnostics show HTTP 400 responses after successful CD reads. Alpha.6 sends correctly encoded include parameters.

Rejected requests, refused access and service errors now have distinct messages. Diagnostics retain the HTTP status and up to 512 characters of a bounded JSON service explanation. Error responses remain subject to a size cap and deadline; raw HTML is not displayed. Recording remains available if metadata cannot be retrieved.

## 2.0.0-alpha.5

This update adds MusicBrainz album lookup to **Add audio CD**. It finds album and artist names and track titles, shows matching editions for review, and can name an empty MiniDisc after the album. It retains the recording helper successfully tested in alpha.4.

### Album lookup

Insert an audio CD and choose **Add audio CD**. **Look up albums automatically with MusicBrainz** is enabled initially and can be turned off; the choice is remembered.

A single exact match is selected for preview. If several editions match, choose the correct **Album / edition**. Possible matches based on similar track lengths always require selection. Check the titles before adding tracks. Album and artist information appears in the queue; click a song title to edit it.

If your MiniDisc is empty and the selected tracks belong to one album, **Name this MiniDisc** offers an album title automatically. You can untick it. The title is included in the recording confirmation and is applied only after the whole selected batch finishes. Adding to a populated MiniDisc does not automatically rename it.

Only CD identifiers and track timings go to MusicBrainz, not your audio files or their local paths. Found albums are cached on this computer for offline reuse. **Look up album** requests a fresh result. A missing album, unavailable service or disconnected Internet does not prevent recording with manual titles. MusicBrainz does not cover every pressing; review its suggestions. Non-Latin titles still need recorder-compatible edits because this alpha uses basic Latin MiniDisc titles.

Existing album/artist tags in local audio files are also read, including uppercase FLAC-style tag names. The same empty-disc naming option works when all selected files belong to one tagged album. There is no online fingerprinting or retagging of local audio files.

## 2.0.0-alpha.4

This update adds audio-CD transfer, Silver/Burgundy/Violet appearance choices, and a targeted change for the recording-session timeout seen in the multiple-song test. It is for the existing Intel/AMD 64-bit Mint 22 / Ubuntu 24.04 desktop test.

### CD to MiniDisc

1. Insert a music CD into the computer's internal or USB CD/DVD drive.
2. Click **Add audio CD**, choose the tracks, then **Add tracks to queue**. With several drives, choose the correct one from the list.
3. Edit song names or change their order in the queue if wanted. Choose **SP** for the first test, then **Record to MiniDisc** and confirm.

Keep the CD and recorder connected until recording finishes. The app reads one CD track at a time using the bundled cdparanoia reader, checks its format and length, then records it. It does not require a separate ripping application or a saved album folder. Temporary audio is removed at the end of the operation.

Initial names are “Track 01”, “Track 02”, etc.; automatic album lookup and CD-Text are not implemented. Standard stereo audio CDs are supported for testing. Pre-emphasis and four-channel tracks are explicitly unavailable. A data CD containing MP3/FLAC files can use **Add audio** instead. CD reading, drive permissions and sound quality still need checking on real hardware.

### Appearance

Open **Appearance** for six palettes: **Walkman orange**, **Forest**, **Midnight blue**, **Silver**, **Burgundy**, and **Violet**. Each offers Light, Dark or Follow system. Your previous choice is preserved.

### What changed in recording

The latest alpha.3 report shows successful MP3 conversion and committed recordings, followed by a one-second USB polling timeout while closing the secure session. One failed two-track batch had actually recorded both tracks; another stopped after committing its first track. Reconnection allowed the listing to be read again.

Alpha.4 gives each close-session response a shared, bounded **20-second budget** across polling and reading. It does not resend audio or automatically retry a failed write. If a session still fails, both recording and Refresh ask for a USB reconnect before contacting that connection again. Explicitly committed tracks are removed from the queue to avoid duplicate recording.

Local protocol and application checks pass, including a simulated slow close that fails under alpha.3 and passes under alpha.4. This is a targeted fix to test, not proof that the recorder's underlying timeout is solved. Full Linux-distribution compatibility and a stable release remain future validation work.

## 2.0.0-alpha.3

This update adds the orange recorder theme and appearance choices, and corrects recording error handling found in the alpha.2 MP3 test. It is for the existing Intel/AMD 64-bit Mint 22 / Ubuntu 24.04 desktop test.

### Choose the look

Click **Appearance** near Diagnostics. Choose **Walkman orange**, **Forest**, or **Midnight blue**, then **Follow system**, **Light**, or **Dark**. The whole interface changes immediately and remembers your choice. **Reset appearance** returns to orange and Follow system.

The orange palette uses copper, silver and a muted green LCD colour inspired by the MZ-N910. All six palette/brightness combinations have checked text contrast. The updated UI builds successfully; its appearance and persistence still need confirmation in your desktop session.

### What the recording change does

The MP3 was imported and converted successfully in alpha.2. The failure occurred during USB recording-session setup, before the log showed an audio bulk transfer. The old helper continued after setup failures and sometimes treated a negative USB result as a large response length.

Alpha.3 stops at failed setup and incomplete transfers, checks actual USB byte counts, waits for recorder readiness around session transitions, and reports transport errors accurately. Disc headers are read once and used for both group counting and parsing; a failed header read cannot become an apparently ungrouped disc. Cleanup releases packet memory safely and reports a completed commit separately from a later cleanup failure.

The app stops the queue after a helper failure and requires USB reconnection before another recording attempt in that app session. If the helper explicitly confirmed the commit, the completed item is removed from the queue even when cleanup fails. There is no automatic recording retry.

Local checks pass: 48 native protocol/lifecycle cases, 18 application tests, production UI build, and native helper dependency/startup checks. These checks do **not** establish that the MZ-N910's underlying USB timeout has been eliminated. The hardware retest above is still required.

This remains an alpha for the tested Mint setup, not a release claiming compatibility with every Linux distribution. The original alpha.2 files retain their original hashes.

## 2.0.0-alpha.2

The first MZ-N910 report confirmed USB enumeration, opening the recorder, claiming its interface and disc-information initialization. It then stopped at the alpha.1 helper's `Incomplete disc capacity response` check. The report did not contain the response bytes or length, so it does not by itself prove which reply the recorder sent.

Investigation found a regression introduced in our diagnostic patch: the minimum reply length was set to 48 bytes. The upstream decoder describes 46 bytes: a 25-byte header and three records containing a two-byte size plus a five-byte BCD time. The old patched helper rejects a synthetic valid 46-byte reply; the corrected production C reader accepts it and decodes all three times correctly.

Changes:

- Accept the complete 46-byte capacity format while rejecting truncated replies.
- Check response status and the three time-record length fields before parsing.
- Log the handshake result, reply length, and useful bytes on a rejected capacity reply.
- Run eight native regression cases during the native build; retain the existing 15 service tests.
- Give each connection-test version its own archive and extracted folder, and print that version at startup.
- Omit unused audio-converter source archives from the connection test. Source and licenses for every binary in that test remain included.

Protocol references in the pinned upstream source: `netmd/libnetmd.py:getDiscCapacity`, `libnetmd/utilities/logparse.pl:DecodeDiscCapacityReply`, and `libnetmd/playercontrol.c:netmd_parse_time`.

The eight cases cover the exact 46-byte reply, a reply with trailing bytes, truncation, receive timeout, handshake transport failure, empty handshake response, rejected status and a malformed time record. They are synthetic fixtures with a stubbed USB exchange, not captured MZ-N910 traffic or proof of hardware compatibility.

### Hardware confirmation

The follow-up MZ-N910 report dated 2026-09-13 confirms an 8-byte capacity handshake and an actual **46-byte capacity reply**. The helper exited successfully and returned all **22 LP2 tracks** from a populated, grouped disc. The desktop application's parser accepts that response, including its track metadata. The disc reports zero available time; it is unsuitable for the next recording test.

The tested helper's SHA-256 is `9136649d5ac04e61e0ed88307ef05227170254633418020d0664b8572e5a84d3`. The rebuilt alpha.2 Debian desktop package uses that same binary. The report identifies Linux x86_64 with glibc 2.39; the user identified the desktop as Linux Mint 22.3. Personal disc and track titles are not included in this repository.

The desktop now explains why recording is unavailable on full or grouped discs. A split-download launcher verifies and reconstructs the complete Debian package, then launches from its extracted folder. The user has confirmed the desktop window, audible playback and USB reconnection. Desktop diagnostics show seven consistent successful reads, a selected-track Play command and Stop; all nine helper calls exited successfully. See `VALIDATION.md` for the exact scope.

A subsequent report confirms reading a blank spare disc, importing/converting the generated WAV, recording one 30-second SP track and reading it back with the expected title/mode/duration. The user reports that playback works. Native stderr contains session-cleanup warnings and one delayed metadata read, recorded in `KNOWN_ISSUES.md`; the session is not warning-free.

LP2/LP4 recording and editing remain unverified. These tests use the existing alpha.2 application; app binaries have not changed during validation. The older alpha.1 desktop packages do not contain the capacity fix.
