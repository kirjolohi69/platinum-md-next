# Platinum-MD Next 1.2.0

- **Record onto discs with groups.** New tracks are added after the last track, outside the existing groups, just as when recording on the recorder itself. After each track the app checks that the disc title and groups are unchanged, and stops the queue if they are not.
- Moving, deleting and renaming the disc remain unavailable on grouped discs for now, to protect their group information.
- A full MiniDisc is easier to spot: the record button reads **Disc full** and the free-space line turns red.
- Releases no longer include the old NetMD connection-test download.
- **Fixes the app missing from the menu after upgrading** from an early test version. The installer kept that version's owner-only folder permissions, so other user accounts could not open the app and the menu hid it. Installing 1.2.0 repairs the permissions.
