# Platinum-MD Next 1.1.0

- **Drag and drop:** drop audio files onto the recording queue instead of using **+ Add audio**. Dropping a folder explains that only files can be added.
- **Album order:** files from one album that carry track-number tags are queued in disc and track order, whatever order they were chosen or dropped in. Mixed selections keep their order.
- **Album title after Stop:** pressing **Stop after this track** during the last track of a batch no longer skips naming an empty MiniDisc after the album, because every track was recorded.
- **Project cleanup:** the original Electron-Vue code, old Windows/macOS helper binaries, alpha test-download scripts and the Forgejo publishing path were removed. The alpha notes are combined in `CHANGELOG.md`. Project links, the MusicBrainz contact and the release guide now point to the GitHub repository, and GitHub Actions attaches the installer to each published release.
- The license keeps Gavin Benda's original copyright notice alongside the fork's.

NetMD recording, CD reading and the native helpers are unchanged from 1.0.1. Install the complete `.deb` over the previous version; settings are kept.
