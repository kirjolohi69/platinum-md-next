#!/usr/bin/env python3
"""Reassemble verified local downloads and launch the desktop as a normal user.

Only files in this extracted test folder are created. No downloads, package
installation, USB-rule changes or sandbox overrides are performed.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import zipfile


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def local_name(value):
    if not isinstance(value, str) or Path(value).name != value or value in ('', '.', '..'):
        raise ValueError('The download manifest contains an invalid filename.')
    return value


def part_source(root, part, folder):
    """Read one known member; never extract paths supplied by a ZIP archive."""
    filename = local_name(part['filename'])
    unpacked = root / filename
    if unpacked.is_file():
        return unpacked.open('rb')
    archive_name = local_name(part['archive'])
    for parent in (root.parent, root):
        archive = parent / archive_name
        if archive.is_file():
            with zipfile.ZipFile(archive) as bundle:
                # ZipExtFile keeps its shared reader alive after the ZIP closes.
                return bundle.open(f'{local_name(folder)}/{filename}')
    raise FileNotFoundError(
        f'Missing {archive_name}. Download it into {root.parent}, then run this command again. '
        'Keep the original download filenames.')


def assemble(root, manifest):
    package = root / local_name(manifest['package'])
    if package.is_file() and digest(package) == manifest['sha256']:
        return package
    if shutil.disk_usage(root).free < manifest['size'] + 512 * 1024 * 1024:
        raise RuntimeError('Free at least 1 GB of space in your Downloads folder, then try again.')
    handle, temporary = tempfile.mkstemp(prefix='package-', suffix='.partial', dir=root)
    temporary = Path(temporary)
    try:
        complete_hash = hashlib.sha256()
        complete_size = 0
        with os.fdopen(handle, 'wb') as output:
            for number, part in enumerate(manifest['parts'], 1):
                print(f'Checking download {number} of {len(manifest["parts"])}…', flush=True)
                part_hash = hashlib.sha256()
                size = 0
                with part_source(root, part, manifest['folder']) as source:
                    for chunk in iter(lambda: source.read(1024 * 1024), b''):
                        output.write(chunk)
                        part_hash.update(chunk)
                        complete_hash.update(chunk)
                        size += len(chunk)
                if size != part['size'] or part_hash.hexdigest() != part['sha256']:
                    raise RuntimeError(f'{part["archive"]} is damaged. Download that part again.')
                complete_size += size
        if complete_size != manifest['size'] or complete_hash.hexdigest() != manifest['sha256']:
            raise RuntimeError('The assembled package did not pass its integrity check.')
        temporary.replace(package)
        return package
    finally:
        temporary.unlink(missing_ok=True)


def prepare(root, manifest):
    package = assemble(root, manifest)
    desktop = root / 'desktop'
    marker = desktop / '.desktop-package-sha256'
    if not marker.is_file() or marker.read_text().strip() != manifest['sha256']:
        if desktop.exists():
            raise RuntimeError('An incomplete desktop folder already exists. Move that folder aside and retry.')
        if not shutil.which('dpkg-deb'):
            raise RuntimeError('This test launcher requires dpkg-deb, included with Linux Mint and Ubuntu.')
        print('Unpacking Platinum-MD Next into this folder…', flush=True)
        stage = Path(tempfile.mkdtemp(prefix='desktop-new-', dir=root))
        try:
            result = subprocess.run(['dpkg-deb', '--extract', str(package), str(stage)],
                                    capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(f'Could not unpack the desktop package: {result.stderr.strip()}')
            (stage / '.desktop-package-sha256').write_text(manifest['sha256'] + '\n')
            stage.rename(desktop)
        finally:
            if stage.exists():
                shutil.rmtree(stage)
    app = desktop / 'opt' / 'Platinum-MD Next'
    for name, expected in manifest['appHashes'].items():
        target = app / name
        if not target.resolve().is_relative_to(app.resolve()) or not target.is_file() or digest(target) != expected:
            raise RuntimeError('The unpacked desktop files failed their integrity check. Extract a fresh copy of this test.')
    return app / 'platinum-md-next'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true', help='Check and unpack the application without launching it.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if sys.platform != 'linux' or platform.machine().lower() not in ('x86_64', 'amd64'):
        raise RuntimeError('This desktop test is for 64-bit Intel/AMD Linux Mint 22 or Ubuntu 24.04.')
    if not args.prepare_only and os.geteuid() == 0:
        raise RuntimeError('Run this launcher from your normal account, without sudo.')
    manifest = json.loads((root / 'desktop-test.json').read_text())
    print(f'Platinum-MD Next desktop test {manifest["version"]}', flush=True)
    executable = prepare(root, manifest)
    print('Package and desktop files verified.', flush=True)
    if args.prepare_only:
        return 0
    handle, report = tempfile.mkstemp(prefix='desktop-start-report-', suffix='.txt', dir=root)
    with os.fdopen(handle, 'w') as log:
        log.write(json.dumps({'app': manifest['version'], 'packageSha256': manifest['sha256'],
                              'platform': platform.platform(), 'architecture': platform.machine()}, indent=2) + '\n')
        log.flush()
        print('Opening Platinum-MD Next. Keep this terminal open until you close the app.', flush=True)
        result = subprocess.run([str(executable)], cwd=executable.parent, stdout=log, stderr=subprocess.STDOUT)
        log.write(f'\nDesktop process exit code: {result.returncode}\n')
    if result.returncode:
        print('The desktop could not run successfully. Attach the startup report to this conversation.')
        print('Mint may require an administrator to install the included .deb for sandbox support. '
              'The report will help identify the actual cause.')
    else:
        print('Desktop process closed. If no window appeared, attach the startup report.')
    print(f'Startup report: {report}')
    print('For recorder problems inside the app, use Diagnostics → Save report. Review reports before sharing publicly.')
    return 0 if result.returncode == 0 else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, RuntimeError, zipfile.BadZipFile) as error:
        print(f'Could not prepare the desktop test: {error}', file=sys.stderr)
        sys.exit(1)
