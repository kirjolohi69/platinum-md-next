#!/usr/bin/env python3
"""Split the complete Debian package into manageable local test downloads.

Each ZIP is an ordinary independent ZIP. Extract only the first; the launcher
reads the other ZIP files beside it, verifies every part and reconstructs the
original .deb byte-for-byte. All native sources and licenses stay included.
"""
import hashlib
import json
import math
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
out = root / 'release'
version = json.loads((root / 'package.json').read_text())['version']
package = out / f'Platinum-MD-Next-{version}-linux-amd64.deb'
folder = f'Platinum-MD-Next-{version}'
chunk_size = 35 * 1024 * 1024
count = math.ceil(package.stat().st_size / chunk_size)
parts = []
complete = hashlib.sha256()
with package.open('rb') as source:
    for index in range(1, count + 1):
        chunk = source.read(chunk_size)
        complete.update(chunk)
        parts.append({'archive': f'{folder}-part-{index}-of-{count}.zip',
                      'filename': f'desktop-package.part{index}', 'size': len(chunk),
                      'sha256': hashlib.sha256(chunk).hexdigest()})
app = out / 'linux-unpacked'
app_hashes = {}
for name in ('platinum-md-next', 'resources/app.asar', 'resources/native/bin/netmdcli'):
    with (app / name).open('rb') as source:
        app_hashes[name] = hashlib.file_digest(source, 'sha256').hexdigest()
manifest = {'version': version, 'folder': folder, 'package': package.name,
            'size': package.stat().st_size, 'sha256': complete.hexdigest(),
            'parts': parts, 'appHashes': app_hashes}
with package.open('rb') as source:
    for index, part in enumerate(parts):
        with zipfile.ZipFile(out / part['archive'], 'w', compression=zipfile.ZIP_STORED) as bundle:
            bundle.writestr(f'{folder}/{part["filename"]}', source.read(part['size']))
            if index == 0:
                for name in ('Start-Platinum-MD.sh', 'desktop-test.py'):
                    bundle.write(root / 'scripts' / name, f'{folder}/{name}')
                bundle.writestr(f'{folder}/desktop-test.json', json.dumps(manifest, indent=2) + '\n')
                guide = (root / 'docs/DESKTOP_TEST.md').read_text()
                bundle.writestr(f'{folder}/START-HERE.md', guide)
        print(out / part['archive'])
