#!/usr/bin/env python3
"""Package electron-builder's unpacked application with native dpkg-deb.

No Ruby/FPM runtime or root account is needed to create the package.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from package_support import digest, validate_app, verified_commit

root = Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'package.json').read_text())
product = metadata['productName']
executable = metadata['name']
version = metadata['version']
# Earlier previews used 2.0.0-alpha.N. Keep the package-manager epoch for all
# subsequent releases so the requested 1.0.0 naming remains an upgrade.
deb_version = f"{metadata['debianEpoch']}:{version.replace('-', '~', 1)}"
desktop = metadata['desktopName']
source = root / 'release/linux-unpacked'
commit = verified_commit()
validate_app(source)
assert (source / executable).is_file(), 'Run package:dir or the AppImage build first.'
assert (source / 'resources/app.asar').is_file(), 'Missing packaged application.'
for value in (product, executable, desktop):
    assert '/' not in value and '\n' not in value and "'" not in value, 'Unsupported package metadata.'
output = root / 'release' / f'Platinum-MD-Next-{version}-linux-amd64.deb'
with tempfile.TemporaryDirectory(prefix='platinum-deb-', dir=root / 'release') as folder:
    stage = Path(folder)
    stage.chmod(0o755)
    app = stage / 'opt' / product
    shutil.copytree(source, app, symlinks=True)
    # copytree preserves the build directory's mode (which can be 0700).
    # dpkg installs as root; normal desktop users must traverse this folder.
    app.chmod(0o755)
    profile = (root / 'node_modules/app-builder-lib/templates/linux/apparmor-profile.tpl').read_text()
    profile = profile.replace('${executable}', executable).replace('${sanitizedProductName}', product)
    (app / 'resources/apparmor-profile').write_text(profile)
    control = stage / 'DEBIAN'
    control.mkdir()
    installed_size = sum(f.stat().st_size for f in app.rglob('*') if f.is_file()) // 1024
    (control / 'control').write_text(f'''Package: {executable}
Version: {deb_version}
Section: sound
Priority: optional
Architecture: amd64
Maintainer: Platinum-MD Next contributors
Installed-Size: {installed_size}
Depends: libc6 (>= 2.39), libstdc++6 (>= 13.2), libgcc-s1, libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libgbm1, libcups2 | libcups2t64, libudev1, libxkbcommon0, libxss1, libxtst6, libatspi2.0-0 | libatspi2.0-0t64, xdg-utils
Homepage: {metadata['homepage']}
Description: Manage and record music to a NetMD MiniDisc recorder
 Record audio files and CDs in SP, LP2 or LP4, look up CD album information,
 edit tracks and control playback. Includes the desktop runtime and tools.
 Targets Linux Mint 22 and Ubuntu 24.04 on Intel/AMD 64-bit computers.
''')
    for template, name, guard in [
        ('after-install.sh', 'postinst', '[ "$1" = configure ] || exit 0'),
        ('after-remove.sh', 'postrm', 'case "$1" in remove|purge) ;; *) exit 0 ;; esac')]:
        content = (root / 'packaging/linux' / template).read_text()
        content = content.replace('${executable}', executable).replace('${sanitizedProductName}', product)
        content = content.replace('#!/bin/bash', '#!/bin/bash\n' + guard, 1)
        (control / name).write_text(content)
        (control / name).chmod(0o755)
    icon = stage / f'usr/share/icons/hicolor/256x256/apps/{executable}.png'
    icon.parent.mkdir(parents=True)
    shutil.copyfile(root / 'build/icons/256x256.png', icon)
    launcher = stage / 'usr/share/applications' / desktop
    launcher.parent.mkdir(parents=True)
    launcher.write_text(f'''[Desktop Entry]
Name={product}
Exec="/opt/{product}/{executable}" %U
TryExec=/usr/bin/{executable}
Terminal=false
Type=Application
Icon={executable}
StartupWMClass={desktop.removesuffix('.desktop')}
Comment=Manage and record music to a NetMD MiniDisc recorder
Categories=AudioVideo;Audio;
''')
    rules = stage / 'usr/lib/udev/rules.d/70-platinum-md-next.rules'
    rules.parent.mkdir(parents=True)
    shutil.copyfile(root / 'packaging/linux/70-platinum-md-netmd.rules', rules)
    docs = stage / 'usr/share/doc' / executable
    (docs / 'source').mkdir(parents=True)
    for original, name in [('docs/INSTALL.md', 'INSTALL.md'), (metadata['releaseNotes'], 'RELEASE-NOTES.md'),
                           ('docs/CHANGELOG.md', 'CHANGELOG.md'), ('docs/VALIDATION.md', 'VALIDATION.md'),
                           ('LICENSE', 'copyright'), ('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md')]:
        shutil.copyfile(root / original, docs / name)
    bundle = docs / 'source/Platinum-MD-Next.bundle'
    subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=root, check=True)
    subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True, capture_output=True)
    manifest = {'version': version, 'debVersion': deb_version, 'commit': commit, 'files': {}}
    for file in sorted(stage.rglob('*')):
        if not file.is_file() or control in file.parents:
            continue
        assert file.resolve().is_relative_to(stage.resolve()), f'External payload symlink: {file}'
        manifest['files'][file.relative_to(stage).as_posix()] = {
            'sha256': digest(file), 'size': file.stat().st_size, 'mode': file.stat().st_mode & 0o7777}
    (docs / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    payload = [f for f in sorted(stage.rglob('*')) if f.is_file() and control not in f.parents]
    installed_size = sum(f.stat().st_size for f in payload) // 1024
    content = (control / 'control').read_text()
    import re
    (control / 'control').write_text(re.sub(r'Installed-Size: \d+', f'Installed-Size: {installed_size}', content))
    with (control / 'md5sums').open('w') as checksums:
        for file in payload:
            with file.open('rb') as data:
                value = hashlib.file_digest(data, 'md5').hexdigest()
            checksums.write(f'{value}  {file.relative_to(stage).as_posix()}\n')
    # dpkg records root ownership without requiring this build process to be root.
    partial = output.with_suffix('.deb.partial')
    try:
        subprocess.run(['dpkg-deb', '--root-owner-group', '--threads-max=2', '-Zxz', '-z6',
                        '--build', str(stage), str(partial)], check=True)
        partial.replace(output)
    finally:
        partial.unlink(missing_ok=True)
print(f'{output}\n{output.stat().st_size:,} bytes\nSHA-256: {digest(output)}')
