# Platinum-MD Next 1.2.0

- **Record onto discs with groups.** New tracks are added after the last track, outside the existing groups, just as when recording on the recorder itself. After each track the app checks that the disc title and groups are unchanged, and stops the queue if they are not.
- **Edit discs with groups.** Groups are shown in the track list. Deleting and moving tracks and renaming the disc now work on grouped discs: the app updates the group information after every change and reads it back to check it. A group left without tracks is removed, after asking. The previous group information is kept in Diagnostics.
- Discs whose group information the app cannot read safely (for example names with accented characters) stay protected, with an explanation.
- **Fixes moving tracks.** The recorder helper sent each move request twice, so moving a track also moved whichever track took its place (seen on an MZ-N910: moving track 11 to 16 moved tracks 11 and 12 to the end). Each move is now sent once.
- A full MiniDisc is easier to spot: the record button reads **Disc full** and the free-space line turns red.
- Releases no longer include the old NetMD connection-test download.
- **Fixes the app missing from the menu after upgrading** from an early test version. The installer kept that version's owner-only folder permissions, so other user accounts could not open the app and the menu hid it. Installing 1.2.0 repairs the permissions.
