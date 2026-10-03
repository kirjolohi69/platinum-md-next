# Alpha.2: correct disc-capacity reply length

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

## Hardware confirmation

The follow-up MZ-N910 report dated 2026-09-13 confirms an 8-byte capacity handshake and an actual **46-byte capacity reply**. The helper exited successfully and returned all **22 LP2 tracks** from a populated, grouped disc. The desktop application's parser accepts that response, including its track metadata. The disc reports zero available time; it is unsuitable for the next recording test.

The tested helper's SHA-256 is `9136649d5ac04e61e0ed88307ef05227170254633418020d0664b8572e5a84d3`. The rebuilt alpha.2 Debian desktop package uses that same binary. The report identifies Linux x86_64 with glibc 2.39; the user identified the desktop as Linux Mint 22.3. Personal disc and track titles are not included in this repository.

The desktop now explains why recording is unavailable on full or grouped discs. A split-download launcher verifies and reconstructs the complete Debian package, then launches from its extracted folder. The user has confirmed the desktop window, audible playback and USB reconnection. Desktop diagnostics show seven consistent successful reads, a selected-track Play command and Stop; all nine helper calls exited successfully. See `VALIDATION.md` for the exact scope.

A subsequent report confirms reading a blank spare disc, importing/converting the generated WAV, recording one 30-second SP track and reading it back with the expected title/mode/duration. The user reports that playback works. Native stderr contains session-cleanup warnings and one delayed metadata read, recorded in `KNOWN_ISSUES.md`; the session is not warning-free.

LP2/LP4 recording and editing remain unverified. `LP_RECORDING.md` describes the next two individual recordings on the same spare disc. These tests use the existing alpha.2 application; app binaries have not changed during validation. The older alpha.1 desktop packages do not contain the capacity fix.
