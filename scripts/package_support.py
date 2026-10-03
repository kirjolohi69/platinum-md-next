"""Shared verification for the Debian and portable release packages."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent.parent


def verified_commit():
    subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    assert not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=ROOT).strip(), 'Commit source changes before packaging.'
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()


def validate_app(app):
    validate_native(app)
    for name in ['platinum-md-next', 'chrome_crashpad_handler', 'chrome-sandbox',
                 'LICENSE.electron.txt', 'LICENSES.chromium.html', 'icudtl.dat']:
        assert (app / name).is_file(), f'Missing runtime file: {name}'
    subprocess.run(['node', '-e', '''
const fs=require('fs'), path=require('path'), asar=require('@electron/asar');
const file=process.argv[1];
const packaged=JSON.parse(asar.extractFile(file,'package.json')), source=require('./package.json');
for (const key of ['version','homepage','repository','bugs','musicbrainzContact']) {
 if (JSON.stringify(packaged[key]) !== JSON.stringify(source[key])) throw Error('Stale desktop metadata: '+key);
}
function check(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
 const name=path.join(dir,entry.name);
 if (entry.isDirectory()) check(name); else if (!asar.extractFile(file,name).equals(fs.readFileSync(name))) throw Error('Stale desktop file: '+name);
} }
check('app'); check('dist/ui'); check('static/icons');
''', str(app / 'resources/app.asar')], cwd=ROOT, check=True)


def digest(file):
    return file_hash(file, 'sha256')


def file_hash(file, algorithm):
    # hashlib.file_digest needs Python 3.11; Ubuntu 22.04 has 3.10.
    value = hashlib.new(algorithm)
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def validate_native(app):
    native = app / 'resources/native'
    lock = json.loads((ROOT / 'packaging/native/sources.json').read_text())
    assert json.loads((native / 'sources.json').read_text()) == lock
    commits = {name: entry['commit'] for name, entry in lock.items()}
    commits['libgha'] = lock['atracdenc']['submodules']['src/lib/libgha']
    for name, commit in commits.items():
        with tarfile.open(native / 'source' / f'{name}.tar.gz', 'r:gz') as archive:
            assert archive.pax_headers.get('comment') == commit, f'Wrong source revision: {name}'
    assert (native / 'source/netmd-diagnostics.patch').read_bytes() == (ROOT / 'packaging/native/netmd-diagnostics.patch').read_bytes()
    runtime = json.loads((ROOT / 'packaging/native/linux-runtime.json').read_text())
    assert json.loads((native / 'linux-runtime.json').read_text()) == runtime
    licenses = ['linux-minidisc-GPL.txt', 'linux-minidisc-LGPL.txt', 'atracdenc-LGPL.txt',
                'libsndfile-LGPL.txt', 'libgha-BSD.txt', 'ffmpeg-LGPL.txt', 'Vue-MIT.txt',
                'electron-builder-MIT.txt', 'cdparanoia-GPL.txt', 'cdparanoia-LGPL.txt', 'cdparanoia-copyright.txt']
    for package in runtime['packages']:
        licenses.append(package['package'] + '-copyright.txt')
        for source in package['sourceFiles']:
            assert digest(native / 'source/runtime' / source['filename']) == source['sha256'], source['filename']
    for source in json.loads((ROOT / 'packaging/native/cd-reader.json').read_text())['files']:
        assert digest(native / 'source/cdparanoia' / source['filename']) == source['sha256'], source['filename']
    for name in licenses:
        assert (native / 'licenses' / name).stat().st_size > 100, f'Missing license: {name}'
    for name in ['netmdcli', 'ffmpeg', 'ffprobe', 'atracdenc', 'cdparanoia']:
        with (native / 'bin' / name).open('rb') as stream:
            assert stream.read(4) == b'\x7fELF', f'Missing Linux executable: {name}'
    for name in ['libusb-1.0.so.0', 'libjson-c.so.5', 'libgcrypt.so.20', 'libgpg-error.so.0',
                 'libudev.so.1', 'libcap.so.2', 'libcdda_interface.so.0', 'libcdda_paranoia.so.0']:
        assert (native / 'lib' / name).is_file(), f'Missing native library: {name}'
    for name in ['scripts/build-native.sh', 'scripts/build-cd-reader.py', 'scripts/fetch-runtime.py']:
        assert (native / 'source/build-support' / name).read_bytes() == (ROOT / name).read_bytes(), name
