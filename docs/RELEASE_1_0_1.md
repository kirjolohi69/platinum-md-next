# Platinum-MD Next 1.0.1

- Fixes the installed application's owner-only folder permissions, which could hide the launcher and block normal-user startup. The installer now sets the application folder to 0755. Package checks cover normal-user access to every payload directory and file.
- Uses the same Walkman-orange disc symbol for the launcher and application window, replacing the teal MD icon. Orange SVG and matching PNG assets are included in the source.
- Adds a host-independent publishing setup and a Forgejo guide. Codeberg eligibility should be confirmed first because of its announced policy on heavily AI-written projects.

Install the complete `.deb` over 1.0.0; it upgrades the existing package. Finish recording and close the app before upgrading. Saved appearance, CD speed and album cache use the same profile.

The 1.0 source was restored from its embedded Git backup. NetMD, CD reading and audio-encoding code and native helpers are unchanged. Testing covers application regressions, UI build, package contents and permission modes, matching icons, native helper starts and isolated installer scripts. Electron startup could not be completed in this workspace and is not counted as passed. No new graphical desktop or physical-recorder test is claimed.

See [installation](INSTALL.md) and [publishing](PUBLISHING.md). The AI disclosure and upstream credits remain in the README.
