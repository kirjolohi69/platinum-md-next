#!/usr/bin/env python3
"""Fetch checksum-pinned helper libraries and their corresponding source files.

Uses a private staging directory; never installs packages into the host system.
The Electron runtime uses the host's desktop libraries independently.
"""
import hashlib
import json
import pathlib
import platform
import shutil
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
lock = json.loads((ROOT / 'packaging/native/linux-runtime.json').read_text())
if platform.machine() not in ('x86_64', 'AMD64'):
    raise SystemExit('This runtime lock currently supports x86_64 only.')
cache = ROOT / '.cache/runtime'
extracted = cache / 'extracted'
stage = ROOT / 'native'
for folder in (cache, extracted, stage / 'lib', stage / 'licenses', stage / 'source/runtime'):
    folder.mkdir(parents=True, exist_ok=True)

def download(url, digest, destination):
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == digest:
        return
    with urllib.request.urlopen(url, timeout=90) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise RuntimeError('Checksum mismatch: ' + url)
    destination.write_bytes(data)

for package in lock['packages']:
    deb = cache / package['url'].rsplit('/', 1)[-1]
    download(package['url'], package['sha256'], deb)
    subprocess.run(['dpkg-deb', '-x', str(deb), str(extracted)], check=True)
    for source in package['sourceFiles']:
        download(source['url'], source['sha256'], stage / 'source/runtime' / source['filename'])
    copyright_file = extracted / 'usr/share/doc' / package['package'] / 'copyright'
    if copyright_file.is_file():
        shutil.copyfile(copyright_file, stage / 'licenses' / (package['package'] + '-copyright.txt'))

for library in extracted.rglob('*.so*'):
    if not library.is_file():
        continue
    shutil.copyfile(library.resolve(), stage / 'lib' / library.name)
shutil.copyfile(ROOT / 'packaging/native/linux-runtime.json', stage / 'linux-runtime.json')
print('Pinned Linux helper libraries and their source archives are ready.')
