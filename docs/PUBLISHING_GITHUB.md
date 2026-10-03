# Publish Platinum-MD Next 1.0 on GitHub

This guide is for Hannu's Linux Mint computer and a personal GitHub account. You will create a public fork named **platinum-md-next**, upload the existing source history, let GitHub build the installer, and publish **version 1.0.0**. You do not need to write code or install Node.js on your computer.

The README already begins with **“Platinum-MD Next’s modernization is 100% vibe-coded with GPT-6 Astra.”** It also credits the original project and third-party tools. Keep those credits and licenses.

No GitHub repository has been published by this handoff. The steps below run under your own account. Complete them in order; if a command reports an error, stop at that step instead of pasting the remaining commands.

## 1. Install the app and publishing tools

Download `Platinum-MD-Next-1.0.0-linux-amd64.deb`. Close any running Platinum-MD Next window. Double-click the installer and install it, or open a terminal in the download folder and run:

```bash
sudo apt install ./Platinum-MD-Next-1.0.0-linux-amd64.deb
```

This also installs a complete application Git backup at:

```text
/usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle
```

Install the tools used to upload it:

```bash
sudo apt update
sudo apt install git gh python3
```

These commands may ask for your computer password. Terminal password entry does not show characters; that is normal. Create an account at [github.com](https://github.com/) if you do not already have one.

If you only want to recover source without installing the app, use `dpkg-deb -x` to extract the `.deb` into a fresh folder, then use the bundle inside that folder's `usr/share/doc/platinum-md-next/source/` in step 3. Extraction alone does not install the app or its USB rules.

## 2. Sign in to GitHub

Run:

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Follow the browser login instructions and authorize the GitHub CLI. The final command should identify your intended GitHub account. Do not paste access tokens or login codes into a chat or README.

## 3. Restore our source into a new folder

Keep using the same terminal for the remaining commands. Run:

```bash
mkdir -p "$HOME/Projects"
git clone --branch modernization/linux-next /usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle "$HOME/Projects/platinum-md-next"
cd "$HOME/Projects/platinum-md-next"
git remote rename origin source-bundle
git branch -m main
```

This creates `Projects/platinum-md-next` in your home folder. It includes our changes and the original project's history. It does not alter your music. If that destination already exists, choose a fresh folder name in both the clone and `cd` commands; do not delete a project you already use.

The remote named `source-bundle` is just the local backup we restored. We will create a separate `origin` remote for your public fork.

## 4. Create your GitHub fork

Run from that project folder:

```bash
gh repo fork gavinbenda/platinum-md --fork-name platinum-md-next --clone=false --remote=false
PM_GITHUB_USER="$(gh api user --jq .login)"
printf 'Your fork will be: https://github.com/%s/platinum-md-next\n' "$PM_GITHUB_USER"
```

Check that the printed username is yours. This creates a real GitHub fork, so the project visibly credits its upstream parent. It is public because the original project is public. You do not need to create a blank repository separately.

If GitHub says you already have a fork, open that fork and check its name. These instructions assume it is named `platinum-md-next`. If a different existing project already uses that name, stop and resolve the name before continuing; do not overwrite it.

## 5. Set the project's public links and your commit identity

Run:

```bash
python3 scripts/prepare-github.py "$PM_GITHUB_USER"
git config user.name "$PM_GITHUB_USER"
```

The included helper sets the README download link, project homepage, issue tracker and MusicBrainz contact to your new fork. This matters: the privately supplied build does not know your GitHub account yet. The public release will be rebuilt with your real project URL.

For your commit email, open GitHub's **Settings → Emails** at [github.com/settings/emails](https://github.com/settings/emails). Copy your GitHub-provided no-reply email address. Replace `YOUR-GITHUB-NOREPLY-EMAIL` in this command with that address, keeping the quotation marks:

```bash
git config user.email "YOUR-GITHUB-NOREPLY-EMAIL"
```

These two settings apply only to this project. Review and save the link changes:

```bash
git diff -- README.md package.json
git add README.md package.json
git commit -m "Set public fork links and MusicBrainz contact"
```

If the diff viewer fills the terminal, press `q` to leave it. It should show your fork URL in the README and package metadata. This commit is your configuration of the project; previous work keeps its existing commit authorship.

## 6. Upload the source and make it the default

Run:

```bash
git remote add origin "https://github.com/$PM_GITHUB_USER/platinum-md-next.git"
git remote -v
git push -u origin main
gh repo edit "$PM_GITHUB_USER/platinum-md-next" --default-branch main --enable-issues --description "Linux desktop for NetMD MiniDisc recording, including audio CD import"
```

Before the push, the `origin` lines should point to **your account**, not `gavinbenda`. The `source-bundle` lines point to the local source backup. Only `main` is pushed; no force push is used and upstream history remains intact.

Open your fork in the browser. The main page should now show our README, beginning with the GPT-6 Astra disclosure, and version 1.0.0. The download link will work once you publish the release in step 9.

Keep `.deb` files out of the source repository. They belong in Releases. The ignored `release/`, `native/` and `node_modules/` folders are build output; GitHub builds them itself.

## 7. Enable builds and mark version 1.0.0

Open your fork's **Actions** tab. GitHub may ask you to enable workflows for the fork; enable them for your repository. The build is named **Linux Debian build**. It runs on Ubuntu 24.04 and includes application tests, native checks, package verification, installation and a sandboxed desktop smoke check in GitHub's runner. No physical recorder is attached to that runner.

Back in the terminal, mark the version:

```bash
git tag -a v1.0.0 -m "Platinum-MD Next 1.0.0"
git push origin v1.0.0
```

A tag fixes the release to that exact source commit. Do not move or overwrite this tag after publishing a release. If it already exists, inspect it instead of forcing a replacement.

The tag push should start an Actions build. If it does not, start the exact tagged version explicitly:

```bash
gh workflow run linux.yml --repo "$PM_GITHUB_USER/platinum-md-next" --ref v1.0.0
```

In Actions, open the build for `v1.0.0`. A build for `main` may also exist; use the tagged one for the release. Initial native compilation takes time. Wait for all steps to turn green. If a step fails, do not publish its partial output; save that step's error text so it can be fixed.

No custom GitHub secrets or access token need to be added to the workflow. It builds artifacts but does not publish a release on your behalf.

## 8. Download and try the release installer

On the successful tagged workflow's summary page, scroll to **Artifacts**, click **linux-amd64** and download its ZIP. You must be signed in to download workflow artifacts. Extract it into a fresh folder.

It contains the files for release, including:

| File | Purpose |
| --- | --- |
| `Platinum-MD-Next-1.0.0-linux-amd64.deb` | The installer ordinary users need |
| `Platinum-MD-Next-source.tar.gz` | Application source for this build |
| `SHA256SUMS` | Download integrity checks |

An additional connection-test archive may be present. Keep all extracted files together if checking the full checksum list. Right-click that folder, choose **Open in Terminal**, then run:

```bash
sha256sum --check SHA256SUMS
sudo apt install --reinstall ./Platinum-MD-Next-1.0.0-linux-amd64.deb
```

All listed checksums should say `OK`. The reinstall is intentional: this public build has the same 1.0.0 app version as the supplied local build, but now includes your fork's public contact and links.

Open it from the application menu on your current computer. Confirm the recorder appears, your chosen theme is available and album lookup still works. There is no requirement here to find a second computer before publishing. State the actual tested setup: **Linux Mint 22.3 with Sony MZ-N910**, with binaries targeting Mint 22 / Ubuntu 24.04 amd64. Do not advertise universal Linux or universal recorder compatibility.

GitHub keeps these workflow artifacts for only 14 days in our configuration. A GitHub Release is where you make the downloads available long term.

## 9. Publish the release

In your fork's browser page:

1. Open **Releases** and choose **Draft a new release** (or **Create a new release**).
2. Choose the existing **v1.0.0** tag.
3. Set the title to **Platinum-MD Next 1.0.0**.
4. Paste the release text below into the description.
5. Attach the `.deb`, `Platinum-MD-Next-source.tar.gz` and `SHA256SUMS` from the same successful tagged build. Include the connection-test archive too if it is listed in that checksum file.
6. Leave **Set as a pre-release** unchecked. Mark it as the latest release if that option is shown.
7. Check the assets and description, then click **Publish release**.

Suggested release description:

```markdown
Platinum-MD Next 1.0.0 is a Linux modernization of Platinum-MD. The modernization is 100% vibe-coded with GPT-6 Astra; upstream and third-party work retain their original credits and licenses.

Download **Platinum-MD-Next-1.0.0-linux-amd64.deb** below. Double-click to install, then open Platinum-MD Next from the application menu and reconnect the recorder once.

Features include local-file and audio-CD recording in SP/LP2/LP4, MusicBrainz album lookup, an editable queue, recorder playback controls, CD speed requests and eight appearance palettes.

Targets Linux Mint 22 / Ubuntu 24.04 on Intel/AMD 64-bit computers. Used successfully on Linux Mint 22.3 with a Sony MZ-N910, including LP2/LP4 listening. Other systems and recorder models remain unverified.

CD reading speed depends on the drive and disc; error correction remains enabled. After recording, if the MZ-N910 lid remains locked, press its physical STOP button and wait for TOC Edit to clear. Keep power connected while it saves.

Known limits: no Hi-MD, MiniDisc audio extraction, group editing, automatic updates, Windows or macOS build. Grouped-disc write restrictions remain. See the repository's installation guide and release notes.

Source and component licenses are included with the installer. The `.deb` is the application download; GitHub's automatically generated Source code archives are for developers.
```

This publishes to your fork only. Check that the README's download link opens the new release and that its `.deb` asset downloads. You can now share your repository URL and release URL.

## 10. Make the repository easy to find

In the repository's **About** box, add topics such as `minidisc`, `netmd`, `linux` and `electron`. A screenshot of the app is helpful; check it for private track names first. Keep the first-line AI disclosure, upstream credit, tested-platform statement and installation instructions visible in the README.

Issues are enabled by step 6. Ask people reporting bugs to include their app version, Linux version, recorder model, what they did and a reviewed Diagnostics report. Reports can contain music titles and local paths; do not publish your private diagnostics as release assets.

## Later updates

Keep your source folder. For a future revision, ask the coding assistant to update the app, bump its version to **1.0.1** (or later), synchronize `package.json`, `package-lock.json`, the UI fallback and versioned documentation, run checks, and commit the work. Keep `debianEpoch: 1` so upgrades continue sorting correctly after the former 2.0 alpha builds.

Push the updated source, make a new matching tag such as `v1.0.1`, wait for its build, install that build and publish a new release. Never replace a published 1.0.0 installer with different code under the same filename/tag. The first local-to-public rebuild above happens before the first public release.

Each revision is a complete `.deb`. Users install the new file over the old installation. There is no automatic updater and no need to merge folders. There is also no need to rerun `prepare-github.py` unless the repository moves.

## If something goes wrong

- **A terminal was closed:** reopen it, run `cd "$HOME/Projects/platinum-md-next"`, then `PM_GITHUB_USER="$(gh api user --jq .login)"` before continuing at the next unfinished step. Do not repeat cloning, remote creation or tagging blindly.
- **`gh` is not signed in or push authentication fails:** run `gh auth status`; sign in to the correct account and run `gh auth setup-git` again. If GitHub rejects a workflow file for insufficient OAuth scope, use `gh auth refresh --hostname github.com --scopes workflow`, approve it in your browser and retry the push.
- **Git says `Author identity unknown`:** finish the local `git config user.name` and `git config user.email` commands in step 5.
- **A fork or `main` already has your own changes:** stop before pushing. Do not use `--force`; preserve and reconcile the existing project first.
- **The GitHub page still shows old Platinum-MD:** check that your fork's default branch is `main` and the push succeeded.
- **Actions is missing or disabled:** enable Actions for your fork. Under repository **Settings → Actions → General**, allow the pinned GitHub-owned actions used by the workflow. Then run step 7's explicit workflow command.
- **The build fails:** open the first failing step and copy its error, plus the workflow URL. A build failure is not fixed by marking the release stable or skipping tests.
- **Downloads show only “Source code (zip)” and “Source code (tar.gz)”:** edit the release and attach the `.deb` from the successful Actions artifact. Those automatic source downloads do not install the app.

## Official references

- [GitHub CLI login](https://cli.github.com/manual/gh_auth_login) and [Git credential setup](https://cli.github.com/manual/gh_auth_setup-git)
- [Forking with GitHub CLI](https://cli.github.com/manual/gh_repo_fork)
- [Repository settings with GitHub CLI](https://cli.github.com/manual/gh_repo_edit)
- [Setting your commit email](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)
- [Running a workflow for a tag](https://cli.github.com/manual/gh_workflow_run)
- [Downloading workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
- [Managing GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
