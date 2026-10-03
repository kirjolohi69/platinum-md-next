#!/usr/bin/env python3
"""Regenerate packaging/native/linux-runtime.json from the Ubuntu archive.

Picks the newest version of each bundled helper library available for the
baseline release (including its -updates and -security pockets) and records
the binary package and its source files with SHA-256 checksums. Run it when a
security update for one of these libraries is published; review the diff.
"""
import gzip
import json
import lzma
import pathlib
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARCHIVE = 'https://archive.ubuntu.com/ubuntu'
RELEASE = 'jammy'
BASELINE = 'Ubuntu 22.04'
PACKAGES = ['libcap2', 'libgcrypt20', 'libgpg-error0', 'libjson-c5', 'libudev1', 'libusb-1.0-0']
POCKETS = [RELEASE, f'{RELEASE}-updates', f'{RELEASE}-security']


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def stanzas(text):
    for block in text.split('\n\n'):
        fields, key = {}, None
        for line in block.splitlines():
            if line.startswith((' ', '\t')) and key:
                fields[key] += '\n' + line.strip()
            elif ':' in line:
                key, value = line.split(':', 1)
                fields[key] = value.strip()
        if fields:
            yield fields


def index(kind):
    entries = []
    for pocket in POCKETS:
        if kind == 'binary':
            data = lzma.decompress(fetch(f'{ARCHIVE}/dists/{pocket}/main/binary-amd64/Packages.xz'))
        else:
            data = gzip.decompress(fetch(f'{ARCHIVE}/dists/{pocket}/main/source/Sources.gz'))
        entries.extend(stanzas(data.decode()))
    return entries


def newer(a, b):
    return subprocess.run(['dpkg', '--compare-versions', a, 'gt', b]).returncode == 0


def newest(entries, name):
    best = None
    for entry in entries:
        if entry.get('Package') == name and (best is None or newer(entry['Version'], best['Version'])):
            best = entry
    if best is None:
        raise SystemExit(f'{name} not found in {RELEASE}')
    return best


binaries, sources = index('binary'), index('source')
packages = []
for name in PACKAGES:
    binary = newest(binaries, name)
    source_name, _, source_version = binary.get('Source', name).partition(' ')
    source_version = source_version.strip('()') or binary['Version']
    source = next(s for s in sources if s['Package'] == source_name and s['Version'] == source_version)
    files = []
    for line in source['Checksums-Sha256'].strip().splitlines():
        digest, _size, filename = line.split()
        files.append({'url': f"{ARCHIVE}/{source['Directory']}/{filename}", 'sha256': digest, 'filename': filename})
    packages.append({'package': name, 'version': binary['Version'], 'url': f"{ARCHIVE}/{binary['Filename']}",
                     'sha256': binary['SHA256'], 'source': source_name, 'sourceVersion': source_version,
                     'sourceFiles': files})
lock = {'architecture': 'x86_64', 'baseline': BASELINE, 'packages': packages}
(ROOT / 'packaging/native/linux-runtime.json').write_text(json.dumps(lock, indent=2) + '\n')
for package in packages:
    print(package['package'], package['version'])
