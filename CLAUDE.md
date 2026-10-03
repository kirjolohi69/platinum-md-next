# Platinum-MD Next: notes for Claude

Read this first. It is the project's memory between sessions.

## The project

Linux desktop app (Electron + Vue) for recording music to NetMD MiniDisc recorders. Fork of Platinum-MD by Gavin Benda. Owned by **kirjolohi69** (Roope K.), who is not a programmer: explain things in plain language, avoid jargon, and say what they need to click or do. Built mainly for a family member of the owner; the owner tests on **Linux Mint 22.3 with a Sony MZ-N910**.

Decisions already made (do not reopen without the owner asking):
- **Linux only.** No Windows/macOS ports (Web MiniDisc Pro already serves those users).
- **No Hi-MD.** Neither the owner nor the family member has Hi-MD hardware.
- Broad Linux support through distro packages rather than an AppImage: `.deb` (Debian 12+, Ubuntu 22.04+, Mint 21+) and `.rpm` (Fedora, openSUSE) since 1.3.0, plus `packaging/arch/PKGBUILD` (repackages the release `.deb`). Not on the AUR yet: the owner has no AUR account (new registrations were closed); publish there once they can.
- README first line is the owner's AI disclaimer; keep it exactly. LICENSE keeps both copyright lines (Gavin Benda 2019; `kirjolohi69 (Roope K.)` 2026). Never add the owner's full name or email anywhere.

## Layout

- `app/` Electron main process. `service.cjs` is the core: every recorder action goes through `NetMdService.operation()` (one at a time) and every write is **verified by reading the disc back**.
- Recording (`upload()` in `service.cjs`) is a pipeline: CD reads/file conversions run one at a time and at most one track ahead of the track being sent; encoding overlaps the next read; check-disc, send and verify stay strictly sequential. Stop or any error aborts background work (AbortSignal) and leaves unsent tracks queued.
- `ui/` Vue 3 interface (`App.vue`), built by Vite into `dist/ui/`.
- `app/preload.cjs` is the only bridge to the sandboxed page; `main.cjs` validates IPC senders and inputs.
- Everything is built on **Ubuntu 22.04** (glibc 2.35), the oldest supported system; `package-deb.py` fails if any bundled program needs a newer glibc/libstdc++. Native helpers (`netmdcli`, `ffmpeg`, `atracdenc`, `cdparanoia`) are built from pinned sources in `packaging/native/` by `scripts/build-native.sh`; their bundled libraries are pinned jammy packages in `linux-runtime.json` (regenerate with `scripts/resolve-runtime.py` after security updates). `package-rpm.py` turns the finished `.deb` into the `.rpm`. `netmdcli` comes from linux-minidisc plus `packaging/native/netmd-diagnostics.patch` (apply with `patch -p1`, not `git apply`).
- `test/modern/*.test.cjs` is the Node test suite; `test/native/` holds the C protocol tests.
- `docs/`: `CHANGELOG.md`, `RELEASE_<version>.md`, `INSTALL.md`, `PUBLISHING.md`, `VALIDATION.md` (hardware history), `KNOWN_ISSUES.md`, `CD_METADATA.md`.

## Checks

- Fast, run before every push: `npm test` and `npm run build`.
- Full (native build, `.deb`/`.rpm`, install, sandboxed desktop smoke test, then `scripts/test-distro.sh` installing on Debian 12/13, Ubuntu 22.04/24.04, Fedora, openSUSE Tumbleweed/Leap and Arch) runs in GitHub Actions on every push and PR. Only merge when it is green. In Claude's container, Debian/Fedora/openSUSE/Arch package servers are blocked (Ubuntu's work); container images come from `mirror.gcr.io` (Docker Hub rate-limits).
- The desktop smoke test hangs in Claude's cloud container (it works on GitHub). To check UI behaviour locally, launch Electron under `xvfb-run` with a small harness script instead of `PLATINUM_SMOKE_TEST`.
- Nobody but the owner can test with a real recorder. Say clearly what was and wasn't tested.

## Safety rules (the app must never damage a user's MiniDisc)

- Never retry a write automatically. Verify every write by reading the disc back; on any mismatch, stop and explain.
- Group information lives inside the raw disc title (`0;Title//1-3;Group//`). `netmdcli settitle` overwrites the whole title. Since 1.2.0 the patched `netmdcli` reports it as `rawTitle`, and `app/groups.cjs` parses/rewrites it. Track commands (`send`, `move`, `delete`, `rename`) never touch it, so after a move/delete the app checks `rawTitle` is unchanged, writes the adjusted line with `settitle` (max 255 bytes), and reads it back. Discs whose line is not printable ASCII or not fully understood stay read-only for move/delete/disc rename (`groupsEditable: false`).
- The MZ-N910 can answer late right after a change. netmdcli exits 3 only when nothing reached the recorder; `NetMdService.netmd()` retries once only then. After any other failed change, `NetMdService.change()` re-reads the disc and accepts the result only if it is exactly the intended one; commands are never repeated.
- Upstream libnetmd bugs fixed in the patch: `netmd_move_track` sent the move twice; `netmd_set_disc_title` wrote with a guessed old length after a failed read. Expect more such bugs: verify on hardware.
- Changes to recording, disc editing, USB or the native patch need the owner's spare-disc hardware test before a release.

## Workflow

- Work on a branch, open a PR to `main`, merge once Actions is green. The owner has authorized merging. Releases are published by the owner (see `docs/PUBLISHING.md`); publishing builds the tag and attaches the `.deb`.
- New version: bump `package.json` + `package-lock.json` (`npm version X --no-git-tag-version`), the fallback in `ui/App.vue`, `docs/INSTALL.md`; write `docs/RELEASE_X.md`, add it to the top of `docs/CHANGELOG.md`, and point `releaseNotes` in `package.json` at it. Keep `debianEpoch: 1`.
- The README's user-facing parts (download, requirements, tested-with) describe the **latest published release**, never unreleased work. Prepare such changes, and apply them right after the owner publishes.
- Claude's cloud environment cannot delete remote branches; ask the owner, or rely on the repo's auto-delete setting.
- Public comments on GitHub are visible to everyone: be friendly, short, and end them with the Claude Code attribution footer.

## Autonomy (agreed with the owner)

On its own, Claude may: triage and label new Issues and reply to them; fix bugs in a PR and merge it when green; merge Dependabot patch/minor updates when green.

Ask the owner first for: anything that changes recording, disc editing, USB access or the native helper; new features; major-version dependency updates (including GitHub Actions); releases.

## Open work

- Groups: rename/delete/move on grouped discs is hardware-tested. Creating, renaming and removing groups (disc panel **Group**, group-heading **Rename**/**Ungroup**, and `groupName` when recording) was added for 1.2.0; recording into a new group passed the owner's hardware test. Not yet tried on hardware: grouping a disc with no title (writes `0;//1-3;Name//`, as libnetmd does).
- "Does my recorder work?" issue form and a compatibility table.
- 1.3.0 (built on Ubuntu 22.04; .rpm; Arch PKGBUILD) awaits the owner's install-and-record test on Mint before release.
- After each release: update `pkgver` and `sha256sums` in `packaging/arch/PKGBUILD` to the released `.deb`.
- When 1.3.0 is published: restore the README download, requirements and tested-with lines from commit f5d831a (`.rpm`, Debian 12+, Ubuntu 22.04+, Mint 21+, Fedora, openSUSE, Arch).
- Dependabot PRs #2–#7: four patch/minor updates; `actions/checkout` 7 and `actions/setup-node` 7 are majors.
