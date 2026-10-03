# Validation record

## Version 1.0.1: 2026-09-30

The original 1.0.0 installer uploaded by the user matches SHA-256 `7d23769d85ba2c5a85405db2b40157e69be3067727749b0d71959a9479cb4eaa` and contains source commit `46de61df81c9e38a2c8753bfd0cf4341f9181199`. Its archive installs the application folder with mode 0700 and root ownership. A normal user cannot traverse that folder; the desktop entry's TryExec may consequently hide it. Version 1.0.1 normalizes the application folder to 0755, and the package regression now checks ordinary-user read/traverse bits for every payload directory and read bits for every regular payload file. This closes the gap in the old checks, which validated file modes and ran tools as the build user without testing directory access after root ownership.

Launcher and window assets use the same orange disc PNG, with a vector source and a 512-pixel build asset. Package verification checks their equality and packaged static assets. The source and pinned native tools were restored from the supplied installer; recording protocol and CD/encoding behavior are unchanged. All 70 application tests and the production build pass. Package checks cover archive integrity, normal-user access, native helper startup and isolated installer simulations. The Electron Node-mode startup attempt failed in this workspace: direct execution reported a missing libffmpeg.so despite the library being present; supplying its directory then exited with SIGTRAP. Runtime startup is not counted as passed. The explicit --skip-electron-startup option allows the remaining package checks here; default npm run test:deb still requires that startup check. No new graphical or recorder test is claimed.

All 71 Electron runtime files match the supplied 1.0.0 manifest byte for byte. Installer-script simulations model the namespace link inside the isolated workspace, so the build host's /proc does not choose their test branches.

Publishing setup now accepts an HTTPS repository URL for Forgejo/Codeberg or other compatible hosts. Tests check links/contact, preservation of version/disclosure, and failure before mutations for invalid URLs or README markers. The default guide documents host eligibility and a manual release route. No repository has been created, uploaded or remotely built by this handoff.

## Version 1.0.0: 2026-09-23

The user chose 1.0.0 release numbering and a Debian installer as the primary package. This does not expand the tested platform claim beyond Linux Mint 22.3 and Sony MZ-N910. The earlier entries below are historical snapshots, including issues subsequently resolved.

The latest supplied alpha.10 hardware report contains five successful local-file recordings: one SP, one LP2 and three LP4. All five complete conversion/encoding, transfer and readback; commit, key removal, secure-session close and device release report no error. The user confirms LP2/LP4 listening, playback, reconnection and error-free empty-recorder handling. Its actual absent-media response has presence flag `0x80`, correctly handled by alpha.10. Pressing the recorder's physical STOP button clears the lid lock. This is documented in the UI and installation guide; the proven native recording protocol has not been changed in 1.0.

Earlier hardware sessions and the user's feedback confirm CD import/recording and MusicBrainz lookup. The latest report has no CD transfer timings. Older per-track extraction runs took about 47–59 seconds, while their before/after disc queries took under a second combined. Those readings do not prove a drive fault or quantify time spent correcting the disc. Version 1.0 records extraction, before/after disc checks and audio validation separately, including failures, and retains those measurements independently of rolling logs. It preserves the existing read-speed requests and error correction; no speed improvement is claimed.

All 68 application tests pass, including failed CD reads/validation, queue preservation and retained timing records. The production UI build passes. Red and yellow bring the palette count to eight. Five text contrast pairs for each new palette in light/dark mode exceed 4.5:1; this is a numeric check, not a GUI rendering test. The GitHub-link helper has been exercised on an isolated copy, including rejection of an invalid owner.

The Debian release check verifies the actual archive's root ownership, payload hashes/modes, matching application/native source, embedded Git history, five native helper starts and Electron Node-mode startup. It simulates repeated installation-script configuration, upgrade guards, removal/purge, user-namespace/SUID fallback and AppArmor branches in isolated directories. These checks are required by `npm run test:deb`; they do not install into the host or claim a graphical launch. Package version `1:1.0.0` sorts newer than former 2.0 alpha packages. GitHub CI also defines actual installation and a sandboxed Xvfb smoke check; that remote workflow has not been run by this handoff.

The native helper is unchanged from the previously tested alpha.10 build (339 native cases). No new physical-recorder, graphical-desktop, second-computer or live system-installation test has run in this build environment. Other distributions and recorders, fault injection on real hardware and the remaining historical coverage items below remain unverified. A first release can document those limits without labeling user-confirmed functions as untested.

## Historical initial checks

Initial build: 2026-09-13. Code/build checks are distinct from tests requiring a Linux desktop or recorder.

| Check | Result |
| --- | --- |
| Process failure, timeout, concurrency, malformed responses, changed disc, disconnect, cancelled deletion and group protection | Passed locally (18 application tests, including recording recovery and saved appearance) |
| Vue production build | Alpha.3 passed locally; six palette/brightness combinations pass checked text contrast pairs |
| Alpha.3 native protocol and lifecycle regressions | 48 cases passed; patch applies with no fuzz to pinned upstream and rebuilt helper starts with bundled dependencies |
| Alpha.3 small desktop update | Actual archive reconstructs files matching the independent build in a path containing spaces; missing base/corrupt payload/corrupt cached helper rejected. No GUI or hardware was used in these checks |
| Native helper/audio-tool compilation | Passed on Ubuntu 24.04 x86_64 |
| Bundled helper startup/dependency checks | Passed locally |
| Debian, AppImage and portable archive creation | Alpha.1 formats built locally; alpha.2 Debian package rebuilt with the hardware-confirmed helper. AppImage and tar.gz remain alpha.1 |
| Standalone connection-test archive | Built and inspected; failure report saved correctly in an environment without visible USB devices |
| Alpha.2 split desktop downloads | Four ZIPs reconstruct the exact Debian package and extract verified app/helper files, tested in a path containing spaces. Missing/corrupt parts are rejected without leaving a completed package |
| 48 kHz stereo → 44.1 kHz stereo PCM for SP | Passed; format/duration inspected |
| PCM → LP2 / LP4 ATRAC3 RIFF | Passed; codec, block alignment and duration inspected |
| npm dependency audit | Zero reported vulnerabilities after compatible updates; snapshot only |
| Electron renderer / preload launch | Confirmed on the user's Mint desktop by screenshot and alpha.2 app diagnostics. Build-environment launch remains unavailable; CI includes an Xvfb smoke test |
| Desktop install / menu / AppArmor / sandbox-policy checks | System installation and these checks remain pending; the extracted desktop application launches on the user's Mint account |
| Sony MZ-N910 connection and complete disc listing | Passed on one populated, grouped disc: 22 LP2 tracks; actual capacity reply 46 bytes; helper exit 0. Returned data also passes the desktop parser |
| Blank-disc read | Confirmed on the MZ-N910 spare disc: 0 tracks, groupCount 1, available capacity reported |
| SP recording and listening | One 30-second stereo test recorded from the app onto the spare disc; title, SP mode and duration verified in readback; user reports the test works. Session cleanup warnings remain open |
| LP2 / LP4 recording and listening | Pending on hardware; pre-existing LP2 playback does not verify this encoder/transfer path |
| Selected-track playback / Stop | User confirms audible playback; app diagnostics show Play for track 3 and Stop, both helper exit 0 |
| Repeated populated-disc reads / idle USB reconnect | Seven successful desktop reads, each returning the same 22-track listing, including after one observed disconnect/reconnect |
| Pause / previous / next | Not exercised in the supplied diagnostic session |
| Rename / movement / deletion | One SP test deletion verified on the spare disc in the MP3 report; rename/movement remain pending |
| Disconnect during transfer and recovery | Pending on a spare disc |
| Flatpak build / file selection / USB | Pending; configuration is experimental |
| Other distributions and architectures | Pending; no compatibility claim |

## Historical validation targets

Record successful installation, normal-user launch with sandbox enabled, USB setup if required, repeated connect/disconnect, blank/populated disc reads, short recordings in all modes, title/duration/listening checks, editing on a spare disc, cancellation, low-capacity behavior, and recovery from an intentional disconnect.

For every run, record the package checksum, distribution/version, desktop/session, kernel, architecture, recorder model, disc type, result and diagnostics. A USB ID in `app/devices.json` does not prove compatibility with this fork.

## Alpha.2 diagnostic iteration

The first MZ-N910 report confirmed opening and claiming the USB interface and reaching the capacity request. A regression test reproduces alpha.1 rejecting a valid synthetic 46-byte capacity reply. The corrected C reader passes eight protocol cases, and all 15 service tests pass.

The follow-up probe report confirms the actual 46-byte reply and a complete listing of 22 LP2 tracks. Its helper SHA-256 matches the binary in the alpha.2 desktop package. The report specifies x86_64, glibc 2.39 and kernel 7.0.0-31-generic; Linux Mint 22.3 was identified by the user. Later desktop and first SP recording confirmation are recorded below. No private track titles were copied into the repository. See the alpha.2 entry in `CHANGELOG.md`.

The rebuilt `Platinum-MD-Next-2.0.0-alpha.2-linux-amd64.deb` has SHA-256 `addba08350d36300767df4960795b9e356c51e36859188c8b517f9c41eeb6993`. Its packaged application version and full-disc notice were inspected. Split-download reconstruction and extraction passed locally. The user has since confirmed the desktop window and recorder discovery on Mint; system package installation remains unverified.

## Desktop session: 2026-09-13

The supplied alpha.2 desktop report contains 240 events from Electron 44.3.0 on Linux x64. All nine helper invocations exited with code 0: seven complete disc reads, one selected-track Play and one Stop. All seven responses pass the desktop parser and have the same listing revision. No helper-error, operation-error or USB-discovery-error events were recorded, and the captured helper output contains no error/failure warnings.

USB discovery observed removal and reappearance of the MZ-N910. The first reappearance poll showed access pending; the next poll, about two seconds later, showed read/write access and triggered a successful disc read automatically. No permission change was requested or needed in this session. The user confirms that playback was audible through the recorder and that reconnection worked.

That initial report verifies a populated grouped disc, Play/Stop and idle reconnection on this one setup. It did not exercise recording or blank-disc reading; those were tested in the subsequent report below. The remaining playback buttons, disconnection during a transfer, system installation and other distributions remain unverified.

## First SP recording: 2026-09-13

The next supplied report extends the same app session to 550 events and 30 helper invocations. It includes successful reads of a blank, ungrouped spare disc, import of the provided `Platinum-SP-Test-30s.wav`, FFmpeg PCM conversion, and one NetMD send. All invocations exited with code 0 and the app logged no operation-error events, but native stderr contains the warnings described below: exit codes alone do not establish a clean transfer session.

The send transferred 5,292,056 bytes including protocol padding, reported successful secure send and commit, and finished in 10.953 seconds. The immediate readback returned exactly one track named `Platinum-SP-Test-30s`, mode SP, time `00:30:00`; recorded time was `00:00:30.00`. Subsequent reads returned the same track, and Play for track 1 and Stop both completed. The user reports that the requested recording/listening test works. This confirms one short SP test on this recorder, not general audio fidelity or reliability.

After the successful commit and key-forget step, the helper logged a USB polling failure and a mismatched response while leaving the secure session, followed by `netmd_release_dev : Unknown Error`. A later pre-playback disc read took 19.172 seconds and logged polling/disc-title request failures before returning the correct listing. Readback and playback succeeded, but cleanup and recovery must be investigated before a stable release. See `KNOWN_ISSUES.md`.

That proposed LP2/LP4 follow-up is superseded by the later MP3 failure below. Pause those tests until the alpha.3 SP/MP3 retest succeeds.


## MP3 failure and alpha.3 update

The later supplied report contains 694 events and 41 helper starts: 39 normal exits and two helper errors. A confirmed deletion removed the previous SP test and a subsequent read showed the spare disc empty. FFprobe imported an MP3 of approximately 192.225 seconds; FFmpeg produced PCM successfully in approximately 957 ms. The send then failed during secure-session setup, before any logged audio bulk transfer, and the following read failed with a USB timeout. No later successful listing is available.

Alpha.3 changes the native USB/secure-message/recording error paths and disc-header initialization. It adds readiness checks around session transitions, error propagation, short-transfer rejection and a separate committed-but-cleanup-failed result. Forty-eight native cases and eighteen application tests pass. Grouped-disc write restrictions remain in place. See `KNOWN_ISSUES.md` for scope and remaining uncertainty.

The new renderer implements saved orange, forest and blue palettes with light/dark/system brightness. The production build passes, and checked text/background pairs in all six combinations exceed 4.5:1 contrast. Renderer appearance, preference persistence on the user's desktop, and actual hardware behavior remain to be verified on alpha.3. No successful local GUI launch is claimed.

The 5.3 MB update reuses the unchanged alpha.2 Debian download to create a separate alpha.3 folder. Verification used the shipped ZIP, the real alpha.2 package and a path containing spaces; every replacement matched the independently packaged build. Cached preparation passed. Missing base, corrupt payload and corrupt cached helper cases were rejected. These were preparation checks, without launching Electron or using USB.

## Alpha.4: 2026-09-20

The latest alpha.3 report confirms several MP3/SP recordings, playback including Pause/resume, disc renaming and deletion. Two batch attempts failed after a confirmed commit while closing the secure session. Readback after USB reconnection confirmed both tracks from the first batch and the first track from the later batch. The report's 1,000-event ring starts mid-operation, so earlier session activity is not inferred.

- 57 native protocol/lifecycle cases pass. Nine new cases exercise the real receive/secure code with a simulated USB clock: a five-second poll, shared deadline across repeated polls, timeout exhaustion, unplugging, short reply, send failure and ordinary-command timeout preservation. The slow-close case fails against alpha.3 and passes against alpha.4.
- 30 application tests pass, including CD table parsing, changed/unreadable CDs, incomplete extracted audio, selected-track order, recording integration, queued-track recovery and committed-track preservation after a failed readback.
- The Vue production build passes. Twelve palette/brightness combinations meet 4.5:1 in the checked text/background pairs. No local GUI launch or pixel-level visual verification is claimed.
- The cumulative NetMD patch applies without fuzz to the pinned upstream; all patched files match the working source and the distributed helper was built from that verified result.
- The bundled cdparanoia executable and libraries are built from checksum-verified Ubuntu source archives and Debian patches. Source, licenses and the rebuild script accompany the binary. Helper startup passes; no physical CD drive is available here.
- The actual update ZIP is reconstructed with a small, real `.deb` fixture in a path containing spaces. All replacements match the independent build. Cached preparation, missing-base and corruption cases pass, and the unchanged production base pin rejects the fixture. The original alpha.2 `.deb` is unavailable in this resumed workspace, so alpha.4 reconstruction against that original archive is not claimed; its previously recorded SHA-256 and Electron executable hash are retained.

Hardware confirmation is still required for the longer close-response budget, batch completion, CD-drive access and CD audio playback. Source/build checks do not establish support for all Linux distributions. Current checks supersede alpha.3 counts above; earlier observations remain historical records.

## Alpha.4 hardware confirmation and alpha.5 metadata: 2026-09-22

The new alpha.4 diagnostics span 15:05:57–15:19:58 UTC: 755 events, 59 helper starts and 59 successful exits, with no helper-error, operation-error or cleanup-failure events. Thirty MiniDisc reads succeeded. A three-track local-file batch recorded approximately 3:12, 0:30 and 0:24 in SP, with count increments 0→1→2→3. After deletion, a second batch read and recorded two CD tracks, approximately 3:33 and 2:43, with count increments 0→1→2. All five sends committed, forgot the session key, closed the secure session and released the device without errors. CD queries and PCM validation succeeded. Play, Stop and subsequent deletion/readback succeeded. The user confirms the recordings work. Private music titles, file paths and the CD fingerprint are excluded from this source record.

This confirms SP batch recording and CD import/recording on the user's Sony MZ-N910 / Mint x64 setup with alpha.4. It supersedes the earlier pending alpha.4 hardware status. It does not verify LP2/LP4, a clean system install, other recorders or other distributions.

Alpha.5 passes 47 application tests, syntax checks, the production UI build and all five helper startup checks. New checks cover the published MusicBrainz reference Disc ID (including nonzero first-track offset handling), edition/medium mapping, per-track artists, fuzzy mismatch rejection, title normalization, bounded HTTP response size/time, service errors and rate limits, cache reuse/damage, metadata-to-queue integration, local-file tag capitalization, and album-title writes only after a successful confirmed batch on an empty disc. A failed title write never puts committed tracks back in the queue. The native binaries are unchanged from alpha.4; its 57 protocol cases remain the latest native regression run.

MusicBrainz's documentation was retrieved from the official site. A live API attempt in this build environment returned an HTML unavailable page, not usable JSON. No successful live album match, local GUI runtime check, or hardware test of alpha.5 is claimed. The HTTP test includes this unavailable-page failure mode.

The alpha.5 update is checked by reconstructing its actual ZIP with a local Debian fixture, comparing every replacement to the packaged build, checking cached preparation and corruption handling, and confirming that the real production base hash rejects the fixture. The original alpha.2 Debian archive is still unavailable here; its previously verified hash and runtime hash remain pinned.

## Alpha.6 lookup correction: 2026-09-23

The user's report shows successful recorder reads and a successful CD table query. Both MusicBrainz attempts fail with HTTP 400. No claim of a general MusicBrainz outage is supported by that report. Private disc names, offsets and identifiers are excluded here.

Alpha.5 passed literal plus signs to URLSearchParams, which percent-encoded them as `%2B` rather than emitting the documented query separators. Alpha.6 uses the documented `recordings`, `artist-credits` and `discids` options as a space-separated value for proper form encoding. A regression exercises the serialized URL through the real HTTP-client function, rejects the alpha.5 request in a contract fixture, and accepts the corrected request with album/track results. This is a contract fixture, not a live-service success. Error-message/status tests also cover HTTP 400, 403, 502 and 503, bounded JSON diagnostics, oversized error bodies and responses that never finish.

All 50 application tests, eight launcher checks and the production UI build pass. Native code and audio converters are unchanged. Full native corresponding source and license files are included, with archive Git commit IDs and runtime/CD source SHA-256 values checked during packaging. Every revision is a complete ZIP, with a verified Git source backup, requiring no earlier folders or downloads.

The final release gate extracts the real ZIP in an isolated path with spaces, verifies every app file, restores executable bits lost by a ZIP extractor, starts all five helpers, starts Electron in Node mode, and compares the embedded source history to HEAD. This does not test a graphical desktop or hardware. The live API still returns an unavailable HTML page in the build environment, so real album matching, LP2/LP4 listening and clean-system installation remain pending.

## Alpha.7 endpoint-specific correction: 2026-09-23

The alpha.6 report contains two HTTP 400 responses whose retained JSON error identifies the explicit `discids` include as invalid for the DiscID resource. The previous encoding correction was incomplete, and the release-style contract test did not catch the endpoint restriction.

The actual upstream DiscID controller and JSON lookup tests were retrieved from the public MusicBrainz source. The controller explicitly accepts `recordings` and `artist-credits`, excludes both `discids` and `releases`, and always enables media/disc IDs internally. The upstream JSON test shows medium disc IDs returned even without explicit include options. Alpha.7 removes only `discids` from the request; it preserves corrected URL encoding and exact-match detection.

The independently sourced rules and source blob ID are recorded in `test/modern/fixtures/musicbrainz-discid-contract.json`. Before the fix, the revised regression failed with the report's exact HTTP 400 explanation. After the fix it passes. The test rejects alpha.5's encoding, alpha.6's unsupported include and an attempted addition of `releases`, then checks that valid output retains album artist, track titles, track artists and the exact disc match. All 50 application tests and the production build pass. Native code is unchanged; the complete ZIP must pass the same final extraction/helper/runtime/source gate described above.

This is validation against the actual endpoint's source rules and a local response fixture, not a successful live-service call. No graphical desktop or recorder test ran here. A real lookup remains the next user check. Private CD identifiers, offsets and music titles are excluded from this record and the fixtures.

## Alpha.8 CD speed and stage reporting: 2026-09-23

The user confirms alpha.7 album lookup now works. Their screenshot shows a full-CD batch in progress, populated album/track names and two LP4 tracks already on the MiniDisc. It does not confirm completed whole-CD recording or audible LP2/LP4 quality. No private album names or disc identifiers are included here.

The reported slowness is not yet attributable to one stage. Inspection found that LP encoding reused the preceding CD-read or file-conversion status, so time spent encoding could appear to be extraction. The screenshot itself is in the USB-recording stage. Alpha.8 labels and times CD reading, file conversion, LP encoding, pre-transfer disc checking, USB recording and post-recording verification separately. Monotonic elapsed times and success/failure outcomes are logged per track, together with the requested CD speed. CD-read timing includes the pre/post TOC checks and WAV validation.

The actual bundled cdparanoia help and its pinned 3.10.2 source (`main.c` and `interface/scsi_interface.c`) confirm that its default requests full speed, and `-S N` requests a numbered speed. The [upstream manual](https://www.xiph.org/paranoia/manual.html) documents this option as dependent on drive support. Maximum therefore preserves the old argument list; other allowlisted choices add only `-S` and a numeric value. Quiet mode, full correction, `-X`, WAV output, CD identity checks and exact audio validation remain. There is no unverified claim that a drive accepted or achieved the requested speed.

All 56 application tests pass, including every speed choice, rejected malformed IPC requests before helpers/confirmation, preference recovery, applying speed to both tracks of LP2/LP4 batches, status at the actual encoder/send invocation, immutable prior-step timings and encoder failure before any USB write. Existing regressions still cover changed/unreadable CDs, readback failures, session failures and never resending committed tracks. The production UI build passes. Native binaries and audio formats are unchanged.

Release packaging checks every packaged app/UI file against source, native source hashes and licenses, then includes the full Git history in the standalone ZIP. The final extraction test must pass the same eight launcher fixtures and actual-ZIP file/helper/runtime/source checks as alpha.7. No physical-drive speed measurement, graphical desktop test, new recorder run or LP listening test took place in the build environment.

## Alpha.9 empty-recorder, USB permissions and diagnostic retention: 2026-09-23

The two latest alpha.8 reports show title-query rejection after successful USB open/claim when the user connects an empty MZ-N910. The later report also shows the same newly enumerated USB node changing from not writable to writable about two seconds later, followed by successful disc reads. The old UI retained the access error after that recovery. No persistent permission failure is demonstrated by these reports.

Both reports contain exactly 1,000 events, dominated by encoder spinner output. Earlier CD timings had already been evicted. The screenshot supplies a separate observation: 2:42 of audio took approximately 47 seconds in the CD-read stage and 13 seconds encoding LP4, or about 3.4× effective extraction including pre/post TOC and audio checks. This does not isolate drive limitations, CD condition, read correction or scan overhead. A separate file recording retained in the report encoded in 14.844 seconds, transferred in 21.121 seconds, then passed readback and album-title verification. This confirms that transfer sequence, not audible LP quality or a completed whole-CD batch. Private titles and identifiers are excluded from this document and fixtures.

The helper now retains the specific rejected-title result. Only read-only listings use it to query disc presence; transport failures and recording commands do not take that path. The query, operating-status descriptor open/close and length-prefixed response follow `getStatus` / `isDiscPresent` in [netmd-js](https://github.com/asivery/netmd-js/blob/master/src/netmd-interface.ts), cross-checked against [linux-minidisc's Python interface](https://github.com/AlexanderS/linux-minidisc/blob/master/netmd/libnetmd.py). A valid known zero presence state yields explicit JSON with `discPresent: false`. Short, malformed, rejected, unknown-state and failed-close responses never become absence. Normal successful disc listings keep the previous command sequence.

Application code treats confirmed absence as an informational connection state and preserves disc-write guards. The device monitor is serialized, pauses during other operations and allows six seconds for initial USB permissions to settle. Only connection warnings clear on recovery; operation failures retain their own UI state. Encoder spinner summaries greatly reduce renderer message traffic, and a separate bounded record retains stage measurements for the most recent 255 queued tracks independently of log rollover.

All 66 application tests pass. They include the observed two-second permission transition, one warning for persistent denial, unplug/replug, overlapping polls, empty-versus-blank discs, a removed disc blocking an edit, genuine helper failures remaining errors, fragmented spinner suppression without dropping warning text and independent timing retention. All 71 native protocol cases pass, including 14 new presence-query cases and the existing recording/close-session safeguards. The native patch was applied to a fresh pinned-source export and compared byte-for-byte with the tested source before compiling the helper. Its corresponding source patch and test suite are synchronized into the binary package.

The production UI build and complete-ZIP extraction, integrity, five-helper startup, Electron Node-mode startup and embedded-history checks are release gates. No graphical desktop test, physical absence-query test, CD-drive speed test or LP listening test ran here. The new absence response still requires the user's hardware check.

## Alpha.10 correction to the empty-recorder check: 2026-09-23

The latest alpha.9 report contains 90 events, successful disc reads and three failed presence checks. Each failure follows successful USB open/claim, a rejected title query and a 29-byte presence response. Alpha.9 did not record that response's bytes or distinguish a rejected close from a parsing error. Therefore the report identifies the failing subsystem but cannot prove which byte or check failed. Two temporary USB access transitions recover after approximately two seconds without any `usb-access-blocked` event. There is no persistent permission failure or recording failure in this report; its transfer timing list is empty.

Fresh upstream source was retrieved from [asivery/netmd-js](https://github.com/asivery/netmd-js/blob/master/src/netmd-interface.ts). The retrieved `netmd-interface.ts` has Git blob SHA-1 `3c6bdbcca0150147956cdc623b5110acec4f6b3a`; `query-utils.ts` has blob `1accfe8f8744a41c4e20e946e1ef7af6e38ddcf5`. `isDiscPresent` compares status payload byte 4 with `0x40`; it does not require absent media to report zero. `changeDescriptorState` catches rejected commands. Alpha.9 introduced stricter behavior in both places, and its synthetic tests wrongly enforced those assumptions.

Alpha.10 applies the upstream presence comparison to a validated status payload. Explicit rejected/not-implemented descriptor responses are tolerated, while transport failures, empty replies and unknown response codes still fail. The status response itself must have an accepted/implemented code, the expected header, a matching length and enough payload for the presence byte. A rejected title alone still never proves absence. This logic remains confined to the read-only listing path; native recording/session handling and application write preconditions are unchanged.

The revised regression fails on the alpha.9 source before the production fix. It checks all 256 possible presence values against the independent upstream comparison, plus descriptor rejection, unsupported commands, malformed responses and transport failures. All 339 native cases pass (57 existing cases and 282 presence cases), and all 66 application tests pass. The production UI build passes. The complete native patch was applied to a fresh pinned original export and compared byte-for-byte with the tested source before compiling the helper; corresponding source and tests are synchronized in the package. All five native helpers start with their bundled libraries.

Presence diagnostics now retain each open/status/close reply as a bounded hexadecimal line, its stage and the interpreted flag or parsing mismatch. This is necessary to resolve any remaining device-specific difference without repeating the blind alpha.9 test cycle. No physical recorder is attached here: these tests do not prove the precise cause of the user's 29-byte reply or confirm the hardware fix. Complete-ZIP extraction, file integrity, permission restoration, five-helper startup, Electron Node-mode startup and matching embedded Git history remain the final release gates; no GUI test is claimed.

## 1.2.0 hardware checks: 2026-10-03

Owner's Linux Mint 22.3 desktop with a Sony MZ-N910, normal (non-admin) user account.

- Upgrading over an early alpha left `/opt/Platinum-MD Next` owner-only, so the app was hidden from the menu and could not start. The installer now repairs the folder permissions; after reinstalling, the app appeared and started.
- Recording one LP4 track onto a grouped disc ("Tom Petty", one group) appended it after the last track; groups unchanged.
- Grouped disc: the group was shown; deleting the ungrouped last track, then three tracks inside the group (each followed by a verified group update, 1-19 to 1-16), and renaming a track all succeeded.
- Moving track 11 to position 16 moved tracks 11 and 12 to the end. The app's order check caught it and stopped before writing groups. Cause: upstream `netmd_move_track` sent the move request twice. Fixed in the native patch; `test/native/move.c` covers it. Moving needs re-testing with the fixed helper.
