#!/usr/bin/env python3
"""Set public project links for a Forgejo/Codeberg/GitHub repository."""
import argparse
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('repository_url', help='HTTPS URL of your owner/repository page')
args = parser.parse_args()
url = args.repository_url.rstrip('/')
if url.endswith('.git'):
    url = url[:-4]
parts = urlsplit(url)
try:
    port = parts.port
except ValueError:
    parser.error('Use the HTTPS URL of your repository page.')
if (parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or
        parts.query or parts.fragment or
        not re.fullmatch(r'[A-Za-z0-9.-]+(?::[0-9]+)?', parts.netloc) or
        not re.fullmatch(r'/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', parts.path)):
    parser.error('Use an HTTPS owner/repository URL, without credentials, queries or fragments.')
root = Path(__file__).resolve().parent.parent
readme = root / 'README.md'
text = readme.read_text()
start, end = '<!-- download-start -->', '<!-- download-end -->'
if text.count(start) != 1 or text.count(end) != 1 or text.index(start) >= text.index(end):
    parser.error('README download markers are missing or invalid; no files were changed.')
metadata_file = root / 'package.json'
metadata = json.loads(metadata_file.read_text())
metadata.update(homepage=url, repository={'type': 'git', 'url': f'git+{url}.git'},
                bugs={'url': url + '/issues'}, musicbrainzContact=url)
text = text[:text.index(start) + len(start)] + f'\n\n[Download the .deb installer]({url}/releases).\n\n' + text[text.index(end):]
metadata_file.write_text(json.dumps(metadata, indent=2) + '\n')
readme.write_text(text)
print(f'Updated project links and MusicBrainz contact to {url}.')
print('Review git diff, commit the changes, then build or request a release from that commit.')
