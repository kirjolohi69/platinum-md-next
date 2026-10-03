#!/usr/bin/env python3
"""Verify the actual update payload with a tiny .deb fixture; never launch a GUI.

The original alpha.2 archive is not required. A test-only manifest is passed to
the unchanged prepare() function; the production manifest must reject the fixture.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
release = root / 'release'
version = json.loads((root / 'package.json').read_text())['version']
archive = release / f'Platinum-MD-Next-{version}-update.zip'
with zipfile.ZipFile(archive) as bundle:
    manifest_path = next(name for name in bundle.namelist() if name.endswith('/desktop-update.json'))
    folder = manifest_path.split('/')[0]
    manifest = json.loads(bundle.read(manifest_path))


def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def unpack(parent):
    with zipfile.ZipFile(archive) as bundle:
        assert all(name.startswith(folder + '/') and '..' not in Path(name).parts for name in bundle.namelist())
        bundle.extractall(parent)
    return parent / folder


def rejects(fn, message):
    try:
        fn()
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError('Expected rejection: ' + message)


(root / '.cache').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='alpha5 update test ', dir=root / '.cache') as temp:
    parent = Path(temp)
    update = unpack(parent)
    spec = importlib.util.spec_from_file_location('desktop_update', update / 'desktop-test.py')
    launcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launcher)
    fixture = parent / 'fixture-source'
    (fixture / 'DEBIAN').mkdir(parents=True)
    (fixture / 'DEBIAN/control').write_text('Package: platinum-update-fixture\nVersion: 1\nArchitecture: amd64\nMaintainer: Test <test@localhost>\nDescription: Local extraction fixture; never installed\n')
    executable = fixture / 'opt/Platinum-MD Next/platinum-md-next'
    executable.parent.mkdir(parents=True)
    executable.write_text('Fixture only; this file is never executed.\n')
    executable.chmod(0o755)
    old = parent / manifest['base']['folder']
    old.mkdir()
    base = old / manifest['base']['package']
    subprocess.run(['dpkg-deb', '--root-owner-group', '--build', str(fixture), str(base)], check=True, capture_output=True)
    rejects(lambda: launcher.prepare(update, manifest), 'integrity check')
    assert not (update / 'desktop').exists()
    test_manifest = copy.deepcopy(manifest)
    test_manifest['base']['sha256'] = sha(base)
    test_manifest['appHashes']['platinum-md-next'] = sha(executable)
    prepared, fingerprint = launcher.prepare(update, test_manifest)
    app = prepared.parent
    for name in manifest['files']:
        assert sha(app / name) == sha(release / 'linux-unpacked' / name), name
    assert (app / 'resources/native/bin/cdparanoia').stat().st_mode & 0o111
    assert sha(base) == test_manifest['base']['sha256']
    assert launcher.prepare(update, test_manifest) == (prepared, fingerprint)
    (app / 'resources/native/bin/netmdcli').write_bytes(b'damaged cached helper')
    rejects(lambda: launcher.prepare(update, test_manifest), 'Integrity check failed')
    fresh = unpack(parent / 'fresh')
    rejects(lambda: launcher.prepare(fresh, test_manifest, str(parent / 'missing.deb')), 'not found')
    assert not (fresh / 'desktop').exists()
    (fresh / 'payload/resources/native/bin/netmdcli').write_bytes(b'damaged update')
    rejects(lambda: launcher.prepare(fresh, test_manifest, str(base)), 'Integrity check failed')
    assert not (fresh / 'desktop').exists()
print('Desktop update: production base pin rejects fixture; fixture reconstruction in a path with spaces matches every built replacement; cached preparation, missing base and corruption checks pass. The original alpha.2 archive, GUI and hardware were not tested here.')
