# Recording-session reliability

## Observed in alpha.2

One 30-second SP WAV recording on the Sony MZ-N910 committed successfully, was read back with the expected title, mode and duration, and played audibly. Closing the secure session logged a USB polling failure and a response mismatch. A later metadata read took about 19 seconds before recovering.

The subsequent MP3 report extends the same desktop session. The user first deleted the SP test from the spare disc; the resulting empty listing was verified. MP3 import and FFmpeg conversion to 44.1 kHz stereo PCM both succeeded. During the next recording, initial secure-session cleanup timed out; the old helper continued through failed session entry, key exchange and download setup. The send failed before the captured log showed an audio bulk transfer. A later disc read also failed. There is no successful post-failure listing proving the disc's final state.

This establishes a recording-session/USB failure, not an MP3 decoder failure. It does not establish the underlying cause of the recorder's timeout. Private music titles and local paths are excluded from this record.

## Corrected in alpha.3

- Preserve signed USB receive errors before assigning response lengths; clear stale response data on failure.
- Check actual control-transfer byte counts and stop an exchange after a failed send. Stop bulk transfers on short writes or errors without resending a packet.
- Stop recording setup at its first failure. Check readiness at session boundaries and do not keep issuing cleanup commands after a transport failure.
- Normalize device acquisition/release results to error codes. A successful release reply length is no longer printed as an unknown error.
- Build group allocation and parsing from one validated header. A failed header query cannot masquerade as an ungrouped disc.
- Clear the packet pointer after freeing its list, allowing shared cleanup paths to release resources once.
- Distinguish a confirmed track commit followed by cleanup failure (helper exit 2) from an unconfirmed recording failure (exit 1). The app stops the queue in both cases, removes only explicitly committed items, and blocks another recording attempt on the same USB connection for the remainder of that app session.

Forty-eight native protocol/lifecycle cases and eighteen application tests pass. The native patch applies without fuzz to the pinned source, and the distributed helper was compiled from that verified result. These checks validate error handling; they do not certify that the MZ-N910 timeout is fixed.

## Observed in alpha.3 and changed in alpha.4

The latest report has 1,000 retained events, starting partway through a session. Several individual MP3/SP recordings committed and read back successfully; MP3 decoding was not the failure. Disc renaming, deletion, Play, Pause, resume and Stop also succeeded in the captured events.

Two batches failed while receiving the close-secure-session response, approximately one second after the preceding key-forget step. One batch had committed both tracks, confirmed by readback after reconnecting. The other committed its first track, then stopped before converting or sending the next. Successful closes elsewhere took about four to five seconds. This identifies an overly short per-poll receive limit on that path, but does not prove the full cause of the hardware stall.

Alpha.4 gives each close response a 20-second monotonic deadline shared by poll transfers, waits and response reading. Ordinary protocol commands keep their existing timeout. No audio or command is automatically resent. If the protocol sends an interim response, the existing exchange can receive a second response with its own budget.

Refresh now refuses to contact a connection whose recording session failed, explaining the required USB reconnect. A confirmed commit leaves the queue even if later cleanup or listing fails. A three-item regression verifies that a failure on item two leaves only item three queued.

## Alpha.4 hardware result: 2026-09-22

The new report contains 755 events and 59 helper invocations, all successful. A three-track local-file SP batch and a two-track CD/SP batch each completed; all five recording commits, closes and readbacks succeeded. The user confirms both paths work. Deletion, playback and Stop also succeeded. No helper-error, operation-error or committed-cleanup-failure events appear. This supports the timeout change on this recorder/setup, rather than proving it for all devices.

## Remaining checks

Use [the alpha.7 guide](ALPHA_7.md) to check MusicBrainz lookup. Then confirm the optional empty-disc album title and one short LP2 recording and one LP4 recording with listening. Save diagnostics. Clean-system installation, broader Linux support, other recorders and stable-release recovery checks remain pending.

CD extraction retains cdparanoia correction and abort-on-skip, CD-table rechecks and PCM format/length validation. There is no AccurateRip/bit-perfect certification; discs with identical tables cannot be distinguished by this fingerprint alone. Pre-emphasis and four-channel tracks remain unavailable. MusicBrainz lookup may find several editions, possible matches or no result. Noncontiguous audio-track layouts use manual titles. Online lookup does not identify arbitrary local files.

Alpha.6 keeps the alpha.4 native helper and USB/sandbox policies. Each revision is a complete standalone ZIP requiring no older downloads. The old delta workflow is historical.

## Alpha.5 metadata failure, corrected in alpha.6

The September 23 report shows successful recorder reads and a successful CD table query, followed by two MusicBrainz HTTP 400 responses. Alpha.5 encoded the `inc` separators as literal `%2B` characters. Alpha.6 supplies spaces to the URL encoder, producing the documented `+` query separators, and uses the documented `recordings`, `artist-credits` and `discids` include options. Rejected requests now have a specific message and bounded service details in Diagnostics. Contract regression tests pass; successful live matching still needs checking on the user's computer because the API is unavailable from the build environment.

The next alpha.6 report exposed a second problem: `discids` is rejected by this particular endpoint. Alpha.7 removes it. The server adds disc IDs automatically, so exact matching is retained. The corrected endpoint-specific regression reproduces the report's exact HTTP 400 detail; the older generic-release contract was incomplete. See `CD_METADATA.md` for the checked upstream source and `ALPHA_7.md` for the next lookup check.
