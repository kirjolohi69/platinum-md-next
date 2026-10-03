#!/usr/bin/env python3
from pathlib import Path
import hashlib

out = Path(__file__).resolve().parent.parent / 'release'
lines = []
for file in sorted(out.iterdir()):
    if file.is_file() and (file.name.endswith(('.tar.gz', '.AppImage', '.deb', '.bundle', '.zip', '.wav'))):
        digest = hashlib.sha256()
        with file.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        lines.append(f'{digest.hexdigest()}  {file.name}')
(out / 'SHA256SUMS').write_text('\n'.join(lines) + '\n')
print('Checksums written for', len(lines), 'artifacts')
