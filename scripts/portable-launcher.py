#!/usr/bin/env python3
"""Verify and run this complete download, independently of older versions."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import stat
import subprocess
import sys
import tempfile


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def inside(root, name):
    if not isinstance(name, str):
        raise ValueError('Invalid application path.')
    relative = PurePosixPath(name)
    if relative.is_absolute() or not relative.parts or '..' in relative.parts or '\\' in name:
        raise ValueError('Invalid application path.')
    target = root.joinpath(*relative.parts)
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('An application file points outside this folder.')
    return target


def verify(root, manifest):
    if manifest.get('format') != 1 or not isinstance(manifest.get('files'), dict):
        raise ValueError('Unrecognized manifest. Extract a fresh copy of the ZIP.')
    for name in ['app/platinum-md-next', 'app/resources/app.asar']:
        if name not in manifest['files']:
            raise ValueError('Incomplete application manifest.')
    executables = []
    for name, entry in manifest['files'].items():
        if not name.startswith('app/'):
            raise ValueError('Invalid application path.')
        file = inside(root, name)
        if not file.is_file() or file.stat().st_size != entry['size'] or digest(file) != entry['sha256']:
            raise RuntimeError(f'{name} is missing or damaged. Extract the whole ZIP into a fresh folder.')
        if entry.get('executable'):
            executables.append(file)
    executable = inside(root, 'app/platinum-md-next')
    if executable not in executables:
        raise ValueError('The application executable is missing from the manifest.')
    # ZIP extractors may lose executable bits. Check everything before restoring
    # owner-execute on verified files. Never set setuid or change owners.
    for file in executables:
        mode = stat.S_IMODE(file.stat().st_mode)
        if not mode & stat.S_IXUSR:
            file.chmod((mode & 0o777) | stat.S_IXUSR)
    return executable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check files without opening the app.')
    args = parser.parse_args()
    if sys.platform != 'linux' or platform.machine().lower() not in ('x86_64', 'amd64'):
        raise RuntimeError('This download is for 64-bit Intel/AMD Linux Mint 22 or Ubuntu 24.04.')
    if not args.check and os.geteuid() == 0:
        raise RuntimeError('Run this launcher from your normal account, without sudo.')
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / 'portable.json').read_text())
    print(f'Platinum-MD Next {manifest["version"]}\nChecking application files…', flush=True)
    executable = verify(root, manifest)
    print('Complete application verified. No older downloads are needed.', flush=True)
    if args.check:
        return 0
    handle, report = tempfile.mkstemp(prefix='startup-report-', suffix='.txt', dir=root)
    with os.fdopen(handle, 'w') as log:
        log.write(json.dumps({'app': manifest['version'], 'commit': manifest.get('commit'),
                              'package': 'standalone-zip', 'platform': platform.platform()}, indent=2) + '\n')
        log.flush()
        print('Opening Platinum-MD Next. Keep this terminal open until you close the app.', flush=True)
        result = subprocess.run([str(executable)], cwd=executable.parent, stdout=log, stderr=subprocess.STDOUT)
        log.write(f'\nDesktop process exit code: {result.returncode}\n')
    print('Desktop closed.' if result.returncode == 0 else 'The desktop could not run successfully. Attach the startup report.')
    print(f'Startup report: {report}')
    return 0 if result.returncode == 0 else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError, KeyError, RuntimeError) as error:
        print(f'Could not start Platinum-MD Next: {error}', file=sys.stderr)
        sys.exit(1)
