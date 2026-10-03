#!/usr/bin/env python3
"""Set this fork's public contact/links before its owner builds a GitHub release."""
import argparse
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('owner', help='Your GitHub username or organization')
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?', args.owner):
    parser.error('Enter a GitHub username, not a URL.')
root = Path(__file__).resolve().parent.parent
url = f'https://github.com/{args.owner}/platinum-md-next'
readme = root / 'README.md'
text = readme.read_text()
start, end = '<!-- download-start -->', '<!-- download-end -->'
if not text.count(start) == text.count(end) == 1:
    parser.error('README download markers are missing; nothing was changed.')
text = text[:text.index(start) + len(start)] + (f'\n\n[Download the installer]({url}/releases/latest): `.deb` for Debian, Ubuntu and Mint, '
                     '`.rpm` for Fedora and openSUSE. Arch Linux users can build a package with '
                     '[`packaging/arch/PKGBUILD`](packaging/arch/PKGBUILD).\n\n') + text[text.index(end):]
file = root / 'package.json'
metadata = json.loads(file.read_text())
metadata.update(homepage=url, repository={'type': 'git', 'url': f'git+{url}.git'},
                bugs={'url': url + '/issues'}, musicbrainzContact=url)
file.write_text(json.dumps(metadata, indent=2) + '\n')
readme.write_text(text)
print(f'Updated project links and MusicBrainz contact to {url}.')
print('Review git diff, commit, then build the release from that commit.')
