# Platinum-MD Next: notes for Claude

Read this first. It is the project's memory between sessions.

## The project

Linux desktop app (Electron + Vue) for recording music to NetMD MiniDisc recorders. Fork of Platinum-MD by Gavin Benda. Owned by **kirjolohi69** (Roope K.), who is not a programmer: explain things in plain language, avoid jargon, and say what they need to click or do. Built mainly for a friend of the owner; the owner tests on **Linux Mint 22.3 with a Sony MZ-N910**.

Decisions already made (do not reopen without the owner asking):
- **Linux only.** No Windows/macOS ports (Web MiniDisc Pro already serves those users).
- **No Hi-MD.** Neither the owner nor the friend has Hi-MD hardware.
- More Linux packaging is wanted: `.rpm` (Fedora/openSUSE) and an AUR `PKGBUILD`, rather than an AppImage.
- README first line is the owner's AI disclaimer; keep it exactly. LICENSE keeps both copyright lines (Gavin Benda 2019; `kirjolohi69 (Roope K.)` 2026). Never add the owner's full name or email anywhere.

## Layout

- `app/` Electron main process. `service.cjs` is the core: every recorder action goes through `NetMdService.operation()` (one at a time) and every write is **verified by reading the disc back**.
- `ui/` Vue 3 interface (`App.vue`), built by Vite into `dist/ui/`.
- `app/preload.cjs` is the only bridge to the sandboxed page; `main.cjs` validates IPC senders and inputs.
- Native helpers (`netmdcli`, `ffmpeg`, `atracdenc`, `cdparanoia`) are built from pinned sources in `packaging/native/` by `scripts/build-native.sh`. `netmdcli` comes from linux-minidisc plus `packaging/native/netmd-diagnostics.patch` (apply with `patch -p1`, not `git apply`).
- `test/modern/*.test.cjs` is the Node test suite; `test/native/` holds the C protocol tests.
- `docs/`: `CHANGELOG.md`, `RELEASE_<version>.md`, `INSTALL.md`, `PUBLISHING.md`, `VALIDATION.md` (hardware history), `KNOWN_ISSUES.md`, `CD_METADATA.md`.

## Checks

- Fast, run before every push: `npm test` and `npm run build`.
- Full (native build, `.deb`, install, sandboxed desktop smoke test) runs in GitHub Actions on every push and PR, about 5 minutes. Only merge when it is green.
- The desktop smoke test hangs in Claude's cloud container (it works on GitHub). To check UI behaviour locally, launch Electron under `xvfb-run` with a small harness script instead of `PLATINUM_SMOKE_TEST`.
- Nobody but the owner can test with a real recorder. Say clearly what was and wasn't tested.

## Safety rules (the app must never damage a user's MiniDisc)

- Never retry a write automatically. Verify every write by reading the disc back; on any mismatch, stop and explain.
- Group information lives inside the raw disc title (`0;Title//1-3;Group//`). `netmdcli settitle` overwrites the whole title. Since 1.2.0 the patched `netmdcli` reports it as `rawTitle`, and `app/groups.cjs` parses/rewrites it. Track commands (`send`, `move`, `delete`, `rename`) never touch it, so after a move/delete the app checks `rawTitle` is unchanged, writes the adjusted line with `settitle` (max 255 bytes), and reads it back. Discs whose line is not printable ASCII or not fully understood stay read-only for move/delete/disc rename (`groupsEditable: false`).
- Changes to recording, disc editing, USB or the native patch need the owner's spare-disc hardware test before a release.

## Workflow

- Work on a branch, open a PR to `main`, merge once Actions is green. The owner has authorized merging. Releases are published by the owner (see `docs/PUBLISHING.md`); publishing builds the tag and attaches the `.deb`.
- New version: bump `package.json` + `package-lock.json` (`npm version X --no-git-tag-version`), the fallback in `ui/App.vue`, `docs/INSTALL.md`; write `docs/RELEASE_X.md`, add it to the top of `docs/CHANGELOG.md`, and point `releaseNotes` in `package.json` at it. Keep `debianEpoch: 1`.
- Claude's cloud environment cannot delete remote branches; ask the owner, or rely on the repo's auto-delete setting.
- Public comments on GitHub are visible to everyone: be friendly, short, and end them with the Claude Code attribution footer.

## Autonomy (agreed with the owner)

On its own, Claude may: triage and label new Issues and reply to them; fix bugs in a PR and merge it when green; merge Dependabot patch/minor updates when green.

Ask the owner first for: anything that changes recording, disc editing, USB access or the native helper; new features; major-version dependency updates (including GitHub Actions); releases.

## Open work

- Grouped discs: rename/delete/move is implemented in 1.2.0 and awaits the owner's hardware test. Next step: creating and editing groups in the app.
- "Does my recorder work?" issue form and a compatibility table.
- `.rpm` and AUR packaging.
- README screenshot: the owner will upload `docs/screenshot.png`, then add it under the title.
- Dependabot PRs #2–#7: four patch/minor updates; `actions/checkout` 7 and `actions/setup-node` 7 are majors.
