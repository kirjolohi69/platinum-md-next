# Publish Platinum-MD Next on a Forgejo host

This guide replaces the GitHub-only route. You can keep the source and release downloads on a suitable Forgejo server. Forgejo is the hosting software; Codeberg is one service that runs it. You do not need a GitHub account to follow this guide.

## Choose a suitable host first

Codeberg announced restrictions on heavily AI-written projects in July 2026, with informal exceptions and case-by-case guidance. This fork preserves significant upstream history, but its modernization is openly described as 100% vibe-coded. Do not assume it qualifies for Codeberg: ask the host to confirm before uploading. Keep the disclosure in the README. An independent Forgejo host or your own Forgejo installation can have a different policy.

The instructions below work with a normal Forgejo repository at an HTTPS URL such as `https://forge.example.org/yourname/platinum-md-next`. That address is an example, not a recommended live service. If Codeberg explicitly accepts the project, use your real Codeberg repository URL instead.

Check that the chosen host accepts the project and can store a roughly 151 MB installer as a release asset. Source repositories, release attachments and automated-build capacity can have separate limits. There is no need to self-host a server just to use someone else's Forgejo service.

## 1. Keep the latest installer

Install `Platinum-MD-Next-1.0.1-linux-amd64.deb` normally. Finish recording and close the app first, then double-click the new installer. It upgrades 1.0.0 and keeps the same settings profile.

The installer includes a complete Git source backup at:

```text
/usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle
```

Keep the `.deb` and the separately supplied source archive/checksums. Do not put binary installers into the Git source repository; they belong in release attachments.

## 2. Create an empty public repository

Make an account on the chosen host and sign in through its website. Choose **New Repository**, name it **platinum-md-next**, and make it public. Enable Releases and Issues if the host makes them optional.

Leave options that create an initial README, license or Gitignore unchecked. Our source already includes those files and the original project's history. Copy the repository's HTTPS URL from its page.

The README must retain its first-line AI disclosure, Gavin Benda's upstream credit and the tested-platform statement. The software remains an independent community fork.

## 3. Restore the source on your Mint computer

Install the small publishing tools:

```bash
sudo apt update
sudo apt install git python3
```

Use a fresh folder for the source. The bundle supplied with this installer uses the `modernization/linux-next` branch:

```bash
mkdir -p "$HOME/Projects"
git clone --branch modernization/linux-next /usr/share/doc/platinum-md-next/source/Platinum-MD-Next.bundle "$HOME/Projects/platinum-md-next"
cd "$HOME/Projects/platinum-md-next"
git remote rename origin source-bundle
git branch -m main
```

If the destination already exists, choose a different fresh folder name in the clone and `cd` commands. Do not overwrite an existing project. Keep using this terminal for the next steps.

## 4. Set the actual public project URL

Replace the example URL below with the real repository URL you copied. Keep the quotation marks:

```bash
PM_REPO_URL="https://forge.example.org/yourname/platinum-md-next"
python3 scripts/prepare-forge.py "$PM_REPO_URL"
```

The helper sets the homepage, issue tracker, README Releases link and MusicBrainz contact for your chosen host. It accepts a repository-page URL ending in `/owner/repository`, optionally with `.git`; it rejects embedded credentials and query strings. It does not contact the host or create a repository.

Set your commit identity for this project. Replace the example name and email with your own name and the commit email you want visible publicly. If the host provides a no-reply address, copy it from your account settings:

```bash
git config user.name "YOUR NAME"
git config user.email "YOUR COMMIT EMAIL"
git diff -- README.md package.json
git add README.md package.json
git commit -m "Set public project links and MusicBrainz contact"
```

Press `q` if the diff viewer fills the terminal. Check that the changes use your host URL and keep the AI disclosure.

## 5. Upload the source

Add your repository as `origin`, review it and push:

```bash
git remote add origin "$PM_REPO_URL.git"
git remote -v
git push -u origin main
```

The `origin` lines should point to your new repository. `source-bundle` points to the local backup. No force push is needed.

For HTTPS authentication, Git may ask for your host username and a password/token. Follow the host's instructions. With two-factor authentication, a personal access token may be required instead of your account password; grant the repository access needed to push. Enter it only at the terminal's password prompt. Do not put a token in the remote URL, repository, README or chat. An SSH clone URL is an alternative if you already have SSH set up with that host.

Open the repository page and verify that `main` shows our current README and source. Set `main` as the default branch in repository settings if necessary. Existing upstream commits remain in the history even though the host may not display a cross-service fork relationship.

## 6. Prepare a public installer with matching source

The supplied local installer does not yet know your final hosting URL. Before the first public release, rebuild with the URL configured in step 4 so MusicBrainz receives an actual project contact and the installer matches the published source.

The simplest assisted route is to give the coding assistant your repository URL and the latest `.deb`. If the repository is not accessible, also provide this source bundle from your project folder:

```bash
git bundle create "$HOME/Projects/Platinum-MD-Next-public-source.bundle" --all
```

Ask for a complete public `.deb`, matching source archive, SHA256SUMS and source commit for the first public release. Before that first release is published, the public rebuild can keep version 1.0.1. After publication, every code change must get a new version. Push any returned source changes before tagging their exact commit.

For a local build instead, follow the README's **Build from source** section on Ubuntu 24.04/Mint 22 x64 with Node.js 24. After prerequisites are installed, run from a clean, committed checkout:

```bash
npm ci
npm test
npm run native
npm run test:native
npm run test:audio
npm run package:deb
npm run test:deb
```

The current GitHub Actions workflow does not automatically run on a Forgejo server. Forgejo Actions uses `.forgejo/workflows/` and needs a suitable runner; Codeberg's hosted CI has its own access/setup rules. Automated builds are optional for this first publication. No Forgejo workflow or remote build is claimed as tested by this handoff.

## 7. Test and mark the public release

Install the matching public build on your current computer and check that the app opens from the menu, has the orange disc icon and detects the recorder. The supplied checks and your existing Mint/MZ-N910 tests do not establish support for every Linux distribution or recorder.

When the public installer corresponds to the final source commit, mark it in Git:

```bash
git tag -a v1.0.1 -m "Platinum-MD Next 1.0.1"
git push origin v1.0.1
```

If that tag already exists, stop and inspect it. Never move or overwrite a published release tag.

## 8. Publish through the host's Releases page

Open **Releases → New Release** in your repository. Select the existing `v1.0.1` tag and use the title **Platinum-MD Next 1.0.1**. Paste release notes based on `docs/RELEASE_1_0_1.md`, and state the tested target: **Linux Mint 22 / Ubuntu 24.04 amd64; used with Linux Mint 22.3 and Sony MZ-N910**.

Attach the matching public build's files:

- `Platinum-MD-Next-1.0.1-linux-amd64.deb`
- `Platinum-MD-Next-1.0.1-source.tar.gz`
- `SHA256SUMS`

Leave the pre-release option unchecked. Preview the description and assets, then publish. Make the installer prominent: automatically generated source ZIP/tar downloads are for developers. Source and component licenses are also included in the `.deb`.

Check the README Releases link and download the installer once from the public release. Verify its checksum from the download folder:

```bash
sha256sum --check SHA256SUMS
```

Keep all files listed in SHA256SUMS together for that full check. If a host's attachment limit is too small, choose an appropriate host or arrange an approved release-download location rather than committing a large installer into Git.

## Later revisions

Use 1.0.2 or a higher appropriate version for the next published change. Update `package.json`, `package-lock.json`, the UI version fallback and current documentation; keep `debianEpoch: 1`. Build/test, push the source, make the matching new tag and attach that version's complete `.deb` to a new release.

Users finish recording, close the app and install the new `.deb` over the old version. Preferences use the same profile. The queue is not saved between sessions. There is no automatic updater or folder-merging step.

Keep each public tag immutable. Do not replace a published installer with different code under the same version. For bug reports, ask for the app/Linux version, recorder model, steps and a reviewed Diagnostics report; reports can contain music titles and local paths.

## Official references

- [Forgejo tags and releases](https://forgejo.org/docs/latest/user/repository/releases/)
- [Forgejo Actions](https://forgejo.org/docs/latest/user/actions/overview/)
- [Codeberg's explanation of its AI-project policy](https://blog.codeberg.org/protecting-our-floss-commons-from-llms.html)
- [Codeberg FAQ: hosting and quotas](https://docs.codeberg.org/getting-started/faq/)
- [Codeberg repository setup](https://docs.codeberg.org/getting-started/first-repository/)
- [Codeberg CI](https://docs.codeberg.org/ci/)
- [Codeberg SSH account setup](https://docs.codeberg.org/security/ssh-key/)

The older GitHub-only guide is retained as `PUBLISHING_GITHUB.md` for reference. It is not required by this route.
