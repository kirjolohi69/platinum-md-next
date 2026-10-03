#!/usr/bin/env python3
"""Package every revision as a complete ZIP with runtime and source backup."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent


from package_support import digest, validate_native


def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    assert re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?', version)
    subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    assert not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=ROOT).strip(), 'Commit new files before packaging.'
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    app = ROOT / 'release/linux-unpacked'
    validate_native(app)
    subprocess.run(['node', '-e', '''
const fs=require('fs'), path=require('path'), asar=require('@electron/asar');
const file='release/linux-unpacked/resources/app.asar';
if (JSON.parse(asar.extractFile(file,'package.json')).version !== require('./package.json').version) throw Error('Stale desktop version');
function check(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
 const name=path.join(dir,entry.name);
 if (entry.isDirectory()) check(name); else if (!asar.extractFile(file,name).equals(fs.readFileSync(name))) throw Error('Stale desktop file: '+name);
} }
check('app'); check('dist/ui');
'''], cwd=ROOT, check=True)
    for name in ['platinum-md-next', 'chrome_crashpad_handler', 'chrome-sandbox',
                 'LICENSE.electron.txt', 'LICENSES.chromium.html', 'icudtl.dat']:
        assert (app / name).is_file(), f'Incomplete Electron runtime: {name}'
    folder = f'Platinum-MD-Next-{version}-linux-x64'
    output = ROOT / 'release' / f'{folder}.zip'
    manifest = {'format': 1, 'version': version, 'commit': commit, 'files': {}}
    entries = []
    for file in sorted(app.rglob('*')):
        if not file.is_file():
            continue
        assert file.resolve().is_relative_to(app.resolve()), f'External file: {file}'
        name = 'app/' + file.relative_to(app).as_posix()
        executable = bool(file.stat().st_mode & 0o111)
        manifest['files'][name] = {'sha256': digest(file), 'size': file.stat().st_size, 'executable': executable}
        entries.append((name, file, executable))
    with tempfile.TemporaryDirectory(prefix='portable-package-', dir=ROOT / 'release') as temporary:
        temporary = Path(temporary)
        bundle = temporary / 'Platinum-MD-Next.bundle'
        subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=ROOT, check=True)
        subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=ROOT, check=True, capture_output=True)
        entries += [('Start-Platinum-MD.sh', ROOT / 'scripts/Start-Portable.sh', True),
                    ('start-platinum.py', ROOT / 'scripts/portable-launcher.py', False),
                    ('START-HERE.md', ROOT / 'docs/PORTABLE.md', False),
                    ('LICENSE', ROOT / 'LICENSE', False),
                    ('THIRD_PARTY_NOTICES.md', ROOT / 'THIRD_PARTY_NOTICES.md', False),
                    ('source/Platinum-MD-Next.bundle', bundle, False)]
        alpha = re.search(r'-alpha\.(\d+)$', version)
        notes = ROOT / 'docs' / f'ALPHA_{alpha[1]}.md' if alpha else ROOT / 'docs/RELEASE_1_0.md'
        if notes and notes.is_file():
            packaged_notes = temporary / 'RELEASE-NOTES.md'
            packaged_notes.write_text(notes.read_text().replace('(PORTABLE.md)', '(START-HERE.md)'))
            entries.append(('RELEASE-NOTES.md', packaged_notes, False))
        partial = output.with_suffix('.zip.partial')
        try:
            with zipfile.ZipFile(partial, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
                for name, file, executable in entries:
                    info = zipfile.ZipInfo.from_file(file, f'{folder}/{name}')
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
                    info.compress_type = zipfile.ZIP_DEFLATED
                    with archive.open(info, 'w') as destination, file.open('rb') as source:
                        shutil.copyfileobj(source, destination)
                archive.writestr(f'{folder}/portable.json', json.dumps(manifest, indent=2) + '\n')
            partial.replace(output)
        finally:
            partial.unlink(missing_ok=True)
    print(f'{output}\n{output.stat().st_size:,} bytes; {len(manifest["files"])} verified application files.\nSHA-256: {digest(output)}')


if __name__ == '__main__':
    main()
