# Publishing a release on GitHub

The source lives at [github.com/kirjolohi69/platinum-md-next](https://github.com/kirjolohi69/platinum-md-next). Everything below happens in the GitHub website; no terminal is needed.

GitHub Actions (the **Linux build** workflow) builds and checks the app on every push: application tests, native helper build and tests, `.deb` and `.rpm` packaging, installation and a sandboxed desktop start on Ubuntu 22.04, and installation checks on Debian, Ubuntu, Fedora, openSUSE and Arch Linux. No MiniDisc recorder is attached to GitHub's computers, so recording itself is only tested on your own setup.

## Before a release

1. The version in `package.json` must be the version you are releasing, for example `1.1.0`. When asking the coding assistant for a new version, ask it to bump the version, write `docs/RELEASE_<version>.md`, add it to `docs/CHANGELOG.md` and point `releaseNotes` in `package.json` at it. Keep `debianEpoch: 1`; it makes 1.x packages upgrade the old 2.0 alpha packages.
2. Those changes must be merged into `main`, and the latest build on `main` must be green (a green tick on the repository's front page, or under the **Actions** tab).
3. Optional but recommended: open that green build, download **linux-amd64** under **Artifacts**, install the `.deb` and make a short recording.

## Make the repository public (first release only)

**Settings → General → Danger Zone → Change repository visibility → Make public.** Check the README first: it starts with the AI disclosure and credits Gavin Benda's original project. In the **About** box on the front page you can add a description and topics such as `minidisc`, `netmd`, `linux` and `electron`.

Diagnostics reports can contain music titles and folder paths. Do not attach your own reports to releases or issues without reading them first.

## Publish

1. Open **Releases → Draft a new release**.
2. Under **Choose a tag**, type the version with a `v` in front, for example `v1.1.0`, and choose **Create new tag on publish**. Target: `main`.
3. Title: `Platinum-MD Next 1.1.0`.
4. Description: paste the contents of the matching `docs/RELEASE_<version>.md` file (e.g. `docs/RELEASE_1_2_0.md`). It helps to add a line stating what it was tested with, e.g. *Tested on Linux Mint 22.3 with a Sony MZ-N910. Targets Debian 12+, Ubuntu 22.04+, Mint 21+, Fedora, openSUSE and Arch on 64-bit Intel/AMD.*
5. Click **Publish release**.

Publishing starts a build of that exact tag. When it finishes (usually under an hour) the workflow attaches these to the release automatically:

| File | Purpose |
| --- | --- |
| `Platinum-MD-Next-<version>-linux-amd64.deb` | Installer for Debian, Ubuntu, Mint and similar |
| `Platinum-MD-Next-<version>-linux-x86_64.rpm` | Installer for Fedora and openSUSE |
| `Platinum-MD-Next-source.tar.gz` | Source of this exact build |
| `SHA256SUMS` | Checksums of the attached files |

Before attaching anything, the workflow installs both packages on Debian, Ubuntu, Fedora, openSUSE and Arch Linux; if any of those checks fails, nothing is attached.

**After publishing:** ask the coding assistant to update the Arch Linux recipe (`packaging/arch/PKGBUILD`) to the new version. It needs the checksum of the released `.deb`, which only exists once the release is built.

The **Source code (zip / tar.gz)** links GitHub adds by itself are for developers and do not install anything. The README's download link always opens the newest release.

## If something goes wrong

- **The build failed:** nothing is attached to the release, which is the safe outcome. Open the failed run under **Actions** and give the coding assistant the run link or the red step's error. Once it is fixed, delete the release and its tag (**Releases → … → Delete**, then **Tags → Delete**) and publish again.
- **"The release tag does not match the app version":** the tag (e.g. `v1.1.0`) and `version` in `package.json` must agree. Delete the release and tag and use the right one.
- **Never reuse a version** for different code once people may have downloaded it. Make a new version instead.
