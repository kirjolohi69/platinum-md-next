#!/usr/bin/env python3
"""Build the .rpm (Fedora, openSUSE) from the finished .deb.

The payload is copied from the .deb unchanged, so both packages install the
same files. rpmbuild derives the system library requirements from the
programs themselves (by library name, which works on Fedora and openSUSE
alike); libraries bundled with the app are excluded from that list.
"""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile
from package_support import digest

root = Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'package.json').read_text())
product, executable, version = metadata['productName'], metadata['name'], metadata['version']
deb = root / 'release' / f'Platinum-MD-Next-{version}-linux-amd64.deb'
assert deb.is_file(), 'Run package:deb first.'
output = root / 'release' / f'Platinum-MD-Next-{version}-linux-x86_64.rpm'
# Libraries shipped inside the app folder: Electron's own and the helpers' runtime.
bundled = ['libffmpeg', 'libEGL', 'libGLESv2', 'libvk_swiftshader', 'libvulkan', 'libusb-1\\.0', 'libjson-c',
           'libgcrypt', 'libgpg-error', 'libudev', 'libcap', 'libcdda_interface', 'libcdda_paranoia']


def scriptlet(template, guard):
    text = (root / 'packaging/linux' / template).read_text()
    text = text.replace('${executable}', executable).replace('${sanitizedProductName}', product)
    return text.replace('#!/bin/bash\n', guard + '\n', 1)


with tempfile.TemporaryDirectory(prefix='platinum-rpm-', dir=root / 'release') as folder:
    work = Path(folder)
    payload = work / 'payload'
    subprocess.run(['dpkg-deb', '-x', str(deb), str(payload)], check=True)
    files = [f'"/opt/{product}"', f'/usr/share/applications/{metadata["desktopName"]}',
             f'/usr/share/icons/hicolor/256x256/apps/{executable}.png',
             '/usr/lib/udev/rules.d/70-platinum-md-next.rules', f'%doc /usr/share/doc/{executable}']
    for listed in files:
        path = listed.removeprefix('%doc ').strip('"')
        assert (payload / path.lstrip('/')).exists(), f'Missing from the .deb: {path}'
    spec = work / f'{executable}.spec'
    spec.write_text(f'''Name: {executable}
Version: {version.replace('-', '~')}
Release: 1
Summary: Manage and record music to a NetMD MiniDisc recorder
License: MIT and GPL-2.0-or-later and LGPL-2.1-or-later
URL: {metadata['homepage']}
ExclusiveArch: x86_64
Requires: xdg-utils
Requires(post): bash
Requires(postun): bash
AutoReqProv: yes
%global __requires_exclude ^({'|'.join(bundled)})\\.so.*$
%global __provides_exclude_from ^/opt/.*$
%global debug_package %{{nil}}
%global __os_install_post %{{nil}}
%global __brp_strip %{{nil}}
%define _build_id_links none

%description
Record audio files and CDs in SP, LP2 or LP4, look up CD album information,
edit tracks and groups and control playback on a NetMD MiniDisc recorder.
Includes the desktop runtime and helper tools.

%install
cp -a "{payload}/." "%{{buildroot}}/"

%post -p /bin/bash
{scriptlet('after-install.sh', 'set -e')}

%postun -p /bin/bash
{scriptlet('after-remove.sh', '[ "$1" = 0 ] || exit 0')}

%files
%defattr(-,root,root,-)
{chr(10).join(files)}
''')
    subprocess.run(['rpmbuild', '-bb', '--quiet', '--define', f'_topdir {work / "rpmbuild"}',
                    '--define', '_binary_payload w6.xzdio', str(spec)], check=True)
    built = next((work / 'rpmbuild/RPMS/x86_64').glob('*.rpm'))
    shutil.move(built, output)
print(f'{output}\n{output.stat().st_size:,} bytes\nSHA-256: {digest(output)}')
