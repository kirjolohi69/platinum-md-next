#!/usr/bin/env python3
"""Build a separate updated desktop from the verified local alpha.2 download.

No network access, system installation, permission changes or sandbox overrides.
The old application stays in its original folder.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import subprocess
import sys
import tempfile


def digest(file):
    with file.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def inside(root, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or not relative.parts or '..' in relative.parts or '\\' in name:
        raise ValueError('The update manifest contains an invalid path.')
    target = root.joinpath(*relative.parts)
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('An update file points outside its folder.')
    return target


def verify(root, hashes):
    for name, expected in hashes.items():
        file = inside(root, name)
        if not file.is_file() or digest(file) != expected:
            raise RuntimeError(f'Integrity check failed for {name}. Extract a fresh copy of this update.')


def find_base(root, base, supplied):
    candidates = [Path(supplied).expanduser().resolve()] if supplied else []
    if not supplied:
        for parent in (root.parent, root.parent.parent):
            folder = inside(parent, base['folder'])
            candidates.extend([inside(folder, base['package']),
                               inside(inside(folder, base['folder']), base['package']),
                               inside(parent, base['package'])])
    for file in candidates:
        if file.is_file() and digest(file) == base['sha256']:
            return file
    if any(file.is_file() for file in candidates):
        raise RuntimeError('The alpha.2 package did not pass its integrity check. Keep the original downloads and run the alpha.2 launcher to rebuild it, then close that app and retry this update.')
    raise RuntimeError('The original alpha.2 download was not found. Keep the Platinum-MD-Next-2.0.0-alpha.2 folder beside this new folder in Downloads. If needed, run its launcher once to assemble the original package, close that app, then try again.')


def prepare(root, manifest, supplied=None):
    fingerprint = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    desktop = root / 'desktop'
    marker = desktop / '.desktop-update-sha256'
    app = desktop / 'opt' / 'Platinum-MD Next'
    if marker.is_file() and marker.read_text().strip() == fingerprint:
        verify(app, manifest['appHashes'])
        verify(app, {name: entry['sha256'] for name, entry in manifest['files'].items()})
        return app / 'platinum-md-next', fingerprint
    if desktop.exists():
        raise RuntimeError('An incomplete desktop folder already exists inside this update. Move that desktop folder aside and try again.')
    payload = root / 'payload'
    verify(payload, {name: entry['sha256'] for name, entry in manifest['files'].items()})
    package = find_base(root, manifest['base'], supplied)
    if not shutil.which('dpkg-deb'):
        raise RuntimeError('This update needs dpkg-deb, included with Linux Mint and Ubuntu.')
    if shutil.disk_usage(root).free < 800 * 1024 * 1024:
        raise RuntimeError('Free at least 1 GB in your Downloads folder, then try again.')
    print('Original download verified. Preparing the updated app in this folder…', flush=True)
    stage = Path(tempfile.mkdtemp(prefix='desktop-new-', dir=root))
    try:
        result = subprocess.run(['dpkg-deb', '--extract', str(package), str(stage)], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f'Could not unpack the original package: {result.stderr.strip()}')
        target_app = stage / 'opt' / 'Platinum-MD Next'
        for name, entry in manifest['files'].items():
            source, target = inside(payload, name), inside(target_app, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            target.chmod(entry['mode'])
        verify(target_app, manifest['appHashes'])
        verify(target_app, {name: entry['sha256'] for name, entry in manifest['files'].items()})
        (stage / '.desktop-update-sha256').write_text(fingerprint + '\n')
        stage.rename(desktop)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    return app / 'platinum-md-next', fingerprint


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true', help='Verify and prepare without launching.')
    parser.add_argument('--base-package', help='Optional path to the original alpha.2 .deb download.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if sys.platform != 'linux' or platform.machine().lower() not in ('x86_64', 'amd64'):
        raise RuntimeError('This update is for 64-bit Intel/AMD Linux Mint 22 or Ubuntu 24.04.')
    if not args.prepare_only and os.geteuid() == 0:
        raise RuntimeError('Run this launcher from your normal account, without sudo.')
    manifest = json.loads((root / 'desktop-update.json').read_text())
    print(f'Platinum-MD Next {manifest["version"]}', flush=True)
    executable, fingerprint = prepare(root, manifest, args.base_package)
    print('Updated application and helper verified.', flush=True)
    if args.prepare_only:
        return 0
    handle, report = tempfile.mkstemp(prefix='desktop-start-report-', suffix='.txt', dir=root)
    with os.fdopen(handle, 'w') as log:
        log.write(json.dumps({'app': manifest['version'], 'updateSha256': fingerprint,
                              'baseSha256': manifest['base']['sha256'], 'platform': platform.platform()}, indent=2) + '\n')
        log.flush()
        print('Opening Platinum-MD Next. Keep this terminal open until you close the app.', flush=True)
        result = subprocess.run([str(executable)], cwd=executable.parent, stdout=log, stderr=subprocess.STDOUT)
        log.write(f'\nDesktop process exit code: {result.returncode}\n')
    print('Desktop closed.' if result.returncode == 0 else 'The desktop could not run successfully. Attach the startup report.')
    print(f'Startup report: {report}')
    print('For recorder problems, use Diagnostics → Save report. Review reports before sharing publicly.')
    return 0 if result.returncode == 0 else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print(f'Could not prepare the update: {error}', file=sys.stderr)
        sys.exit(1)
