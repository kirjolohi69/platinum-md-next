#!/usr/bin/env python3
"""Make a standalone connection-test archive. No Node.js or Electron required."""
from pathlib import Path
import json
import shutil
import tarfile

root = Path(__file__).resolve().parent.parent
out = root / 'release'
version = json.loads((root / 'package.json').read_text())['version']
stage = out / ('NetMD-Connection-Test-' + version)
stage.mkdir(parents=True, exist_ok=True)
for folder in ('scripts', 'app', 'native/bin'):
    (stage / folder).mkdir(parents=True, exist_ok=True)
for name in ('netmd-probe.py',):
    shutil.copy2(root / 'scripts' / name, stage / 'scripts' / name)
shutil.copy2(root / 'scripts/Probe-NetMD.sh', stage / 'Probe-NetMD.sh')
for file in ('app/devices.json', 'native/bin/netmdcli', 'LICENSE', 'THIRD_PARTY_NOTICES.md'):
    shutil.copy2(root / file, stage / file)
for folder in ('native/lib', 'native/licenses', 'native/source/runtime',
               'native/source/build-support', 'packaging/linux'):
    shutil.copytree(root / folder, stage / folder, dirs_exist_ok=True)
for name in ('linux-minidisc.tar.gz', 'netmd-diagnostics.patch'):
    shutil.copy2(root / 'native/source' / name, stage / 'native/source' / name)
for name in ('sources.json', 'linux-runtime.json'):
    shutil.copy2(root / 'native' / name, stage / 'native' / name)
(stage / 'version.json').write_text(json.dumps({'version': version}) + '\n')
shutil.copy2(root / 'docs/FIRST_TEST.md', stage / 'START-HERE.md')
destination = out / ('NetMD-Connection-Test-' + version + '-linux-x64.tar.gz')
with tarfile.open(destination, 'w:gz') as archive:
    # A report from an earlier local test must never enter a public package.
    archive.add(stage, arcname=stage.name, filter=lambda item: None if
                Path(item.name).name.startswith('netmd-report-') else item)
print(destination)
