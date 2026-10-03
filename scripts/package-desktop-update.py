#!/usr/bin/env python3
"""Create the small alpha.5 update using the pinned alpha.2 package as a base."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
release = root / 'release'
version = json.loads((root / 'package.json').read_text())['version']
assert version == '2.0.0-alpha.5', 'Check the base and release notes before packaging another version.'
base_info = json.loads((root / 'packaging/linux/update-base.json').read_text())
base = release / base_info['package']
source = release / 'linux-unpacked'
folder = f'Platinum-MD-Next-{version}'
stage = release / 'desktop-update-staging' / folder
assert not stage.exists(), 'Move the previous desktop-update-staging directory aside before rebuilding.'
payload = stage / 'payload'
payload.mkdir(parents=True)


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


if base.exists():
    assert digest(base) == base_info['sha256'], 'The original alpha.2 package changed.'
else:
    print('Original base package not present here; retaining its previously verified SHA-256 pin.')
assert digest(source / 'platinum-md-next') == base_info['executableSha256'], 'This delta requires the original Electron runtime.'
paths = ['resources/app.asar', 'resources/native/bin/netmdcli',
         'resources/native/source/netmd-diagnostics.patch',
         'resources/native/source/linux-minidisc.tar.gz',
         'resources/native/licenses/linux-minidisc-GPL.txt',
         'resources/native/licenses/linux-minidisc-LGPL.txt',
         'resources/native/bin/cdparanoia',
         'resources/native/lib/libcdda_interface.so.0', 'resources/native/lib/libcdda_paranoia.so.0',
         'resources/native/licenses/cdparanoia-GPL.txt', 'resources/native/licenses/cdparanoia-LGPL.txt',
         'resources/native/licenses/cdparanoia-copyright.txt']
paths += [str(file.relative_to(source)) for file in (source / 'resources/native/source/cdparanoia').rglob('*') if file.is_file()]
paths += [str(file.relative_to(source)) for file in (source / 'resources/native/source/build-support').rglob('*') if file.is_file()]
files = {}
for name in sorted(paths):
    src, dst = source / name, payload / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    files[name] = {'sha256': digest(src), 'mode': src.stat().st_mode & 0o777}
critical = ['platinum-md-next', 'resources/app.asar', 'resources/native/bin/netmdcli']
manifest = {'version': version,
            'base': {key: base_info[key] for key in ('folder', 'package', 'sha256')},
            'files': files, 'appHashes': {name: digest(source / name) for name in critical}}
(stage / 'desktop-update.json').write_text(json.dumps(manifest, indent=2) + '\n')
shutil.copy2(root / 'scripts/Start-Platinum-MD.sh', stage / 'Start-Platinum-MD.sh')
shutil.copy2(root / 'scripts/desktop-update.py', stage / 'desktop-test.py')
shutil.copy2(root / 'docs/ALPHA_5.md', stage / 'START-HERE.md')
output = release / f'Platinum-MD-Next-{version}-update.zip'
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(stage.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(stage.parent))
print(output)
print(f'{output.stat().st_size:,} bytes; {len(files)} verified replacement/source files.')
