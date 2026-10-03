# Audio-CD metadata

The app uses the public MusicBrainz disc-ID endpoint over HTTPS. No account, API key, third-party Node dependency or audio upload is required. Only the computed disc ID and the CD table of contents (track start offsets and lead-out) are sent. The renderer's `connect-src 'none'` policy stays in place; the existing IPC bridge delegates a scanned CD's lookup to the main process.

Alpha.6 fixes alpha.5's `inc` query encoding: the URL encoder receives a space-separated value and serializes it with `+` separators, as documented by MusicBrainz. Passing literal plus signs had produced `%2B` and HTTP 400 failures. A regression exercises the serialized URL through the HTTP client. Rejected requests and refused access have distinct messages. Error bodies have a 16 KiB cap; only a JSON error string (sanitized to 512 characters) enters Diagnostics alongside the status/code. Raw HTML is not shown to users. The overall deadline and response size limits remain enforced for both successful and failed responses.

**Alpha.7 correction:** the DiscID endpoint does not accept explicit `discids` or `releases` includes, despite the generic error suggesting a dependency on releases. Its controller automatically enables media and disc IDs. The request now uses `inc=recordings+artist-credits`. Matching can still inspect the returned medium's `discs` array. The contract fixture is sourced from `lib/MusicBrainz/Server/Controller/WS/2/DiscID.pm` in `metabrainz/musicbrainz-server`, Git blob `fda61f5238a0c48187777f9534848e5fa996e9df`, retrieved 2026-09-23; the upstream JSON DiscID lookup tests also show disc IDs returned without an explicit include. This fixes a second defect the generic release-style alpha.6 test missed. The new test replays the actual rejection before checking album/track data and exact-match detection.

The CD must have contiguous audio track numbers starting at 1 and a consistent table. The calculation adds the 150-sector lead-in to cdparanoia's LBA offsets, hashes the prescribed uppercase hexadecimal fields, and applies MusicBrainz's modified Base64. It preserves nonzero first-track offsets and matches the official six-track reference vector. Unusual/noncontiguous layouts retain manual import. cdparanoia's existing multisession adjustment is not duplicated.

One exact match can be selected automatically for preview. Several editions require a choice. TOC-based possible matches require compatible counts, positions and durations, are labelled, and are never selected automatically. Album credits and track-specific credits are kept separately. External data is rendered as text. Queue titles are normalized to the recorder's existing basic-Latin limit and cannot introduce group separators.

Positive matches are cached privately in the Electron user-data directory, with bounded entry count/size, schema checks and atomic replacement. Cached results work offline. Refresh can use saved results if the service is unavailable. No network polling or automatic retry loop runs. Calls are spaced at least 1.1 seconds apart; busy responses trigger a cooldown. Each HTTP request has a 12-second overall deadline and 2 MiB response cap, rejects redirects, and fails cleanly on HTML or malformed replies. The recording queue remains usable without metadata.

Album naming is optional, is shown in the recording confirmation, requires an empty ungrouped MiniDisc, and happens after the complete selected batch succeeds. A failed/cancelled batch does not apply the proposed title. A later title failure does not put already committed tracks back in the queue. Local audio-file tags use the same naming option without contacting MusicBrainz or modifying the source files.

## Service identification before public release

Set `musicbrainzContact` in `package.json` to the project's actual public maintainer URL or email before distributing a public release. It becomes the contact part of `Platinum-MD-Next/<version> (<contact>)`. The private preview currently uses `unpublished local preview` because no fork repository/contact has been supplied; it does not invent an email or direct support requests to the original project's author. This is an outstanding publication requirement, not a secret or API credential.

## Primary references

- https://musicbrainz.org/doc/MusicBrainz_API — disc-ID lookup, include parameters and optional TOC matching.
- https://musicbrainz.org/doc/Disc_ID_Calculation — TOC offsets, hashing, Base64 and reference vector.
- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting — per-client pacing and maintainer identification.
- https://github.com/metabrainz/musicbrainz-server/blob/master/lib/MusicBrainz/Server/Controller/WS/2/DiscID.pm — endpoint-specific includes and automatic media/disc IDs; fixture records the checked source blob.
- https://github.com/metabrainz/musicbrainz-server/blob/master/t/lib/t/MusicBrainz/Server/Controller/WS/2/JSON/LookupDiscID.pm — upstream JSON response examples.

The user has confirmed successful album lookup on the desktop. Live API matching was not available in the build environment. Before the first public build, use `scripts/prepare-github.py` as described in [the publishing guide](PUBLISHING.md) to set the fork's real contact. No claim is made that every pressing is covered, or that metadata proves audio extraction accuracy.
