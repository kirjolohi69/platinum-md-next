#!/usr/bin/env python3
"""Build the bundled CD reader from checksum-pinned Ubuntu source archives."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

root = Path(__file__).resolve().parent.parent
work = root / '.cache/native/cd-reader'
stage = root / 'native'
work.mkdir(parents=True, exist_ok=True)
spec = json.loads((root / 'packaging/native/cd-reader.json').read_text())
for entry in spec['files']:
    file = work / entry['filename']
    if not file.exists():
        with urllib.request.urlopen(entry['url'], timeout=60) as response:
            file.write_bytes(response.read())
    if hashlib.sha256(file.read_bytes()).hexdigest() != entry['sha256']:
        raise RuntimeError(f'CD reader source checksum mismatch: {file.name}')

with tempfile.TemporaryDirectory(prefix='build-', dir=work) as temporary:
    build = Path(temporary)
    with tarfile.open(work / spec['original']) as archive:
        archive.extractall(build, filter='data')
    source = build / spec['sourceDirectory']
    with tarfile.open(work / spec['debian']) as archive:
        archive.extractall(source, filter='data')
    for line in (source / 'debian/patches/series').read_text().splitlines():
        if line and not line.startswith('#'):
            subprocess.run(['patch', '--batch', '--fuzz=0', '-p1', '-i', str(source / 'debian/patches' / line)], cwd=source, check=True)
    subprocess.run(['bash', './configure', f'--prefix={build / "unused-install"}',
                    'CFLAGS=-O2 -g -fPIC -fstack-protector-strong -D_FORTIFY_SOURCE=2',
                    'LDFLAGS=-Wl,-z,relro,-z,now'], cwd=source, check=True)
    # The legacy makefile cleans/rebuilds objects for shared libraries; avoid a parallel make race.
    subprocess.run(['make', '-j1', 'all'], cwd=source, check=True)
    for name in ['bin', 'lib', 'licenses', 'source/cdparanoia', 'source/build-support/scripts', 'source/build-support/packaging/native']:
        (stage / name).mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / 'cdparanoia', stage / 'bin/cdparanoia')
    for directory, library in [('interface', 'libcdda_interface'), ('paranoia', 'libcdda_paranoia')]:
        shutil.copy2(source / directory / f'{library}.so.0.10.2', stage / 'lib' / f'{library}.so.0')
    for original, target in [('COPYING-GPL', 'cdparanoia-GPL.txt'), ('COPYING-LGPL', 'cdparanoia-LGPL.txt'),
                             ('debian/copyright', 'cdparanoia-copyright.txt')]:
        shutil.copy2(source / original, stage / 'licenses' / target)
for entry in spec['files']:
    shutil.copy2(work / entry['filename'], stage / 'source/cdparanoia' / entry['filename'])
shutil.copy2(root / 'scripts/build-cd-reader.py', stage / 'source/build-support/scripts/')
shutil.copy2(root / 'packaging/native/cd-reader.json', stage / 'source/build-support/packaging/native/')
print('CD reader built; exact source, patches, build script and licenses included.')
