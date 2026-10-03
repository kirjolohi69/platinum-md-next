#!/usr/bin/env python3
"""Inspect and extract the real .deb; simulate hooks without changing the host."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from package_support import ROOT, digest, validate_app

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--skip-electron-startup', action='store_true',
                    help='Explicitly omit Electron startup in a constrained build workspace; report it as unverified.')
options = parser.parse_args()
meta = json.loads((ROOT / 'package.json').read_text())
archive = ROOT / 'release' / f'Platinum-MD-Next-{meta["version"]}-linux-amd64.deb'
assert archive.is_file(), 'Build the .deb first.'


def run(*args, **kwargs):
    return subprocess.run(list(map(str, args)), check=True, capture_output=True, text=True, **kwargs).stdout


def check_hooks(control, app, workspace):
    # Each command is a stub or writes only below this test's private root.
    # Never execute a maintainer script against the real /opt, /etc or /usr.
    stub_code = '''import os, pathlib, shutil, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
root = pathlib.Path(os.environ['HOOK_ROOT'])
with open(os.environ['HOOK_LOG'], 'a') as log: log.write(name+' '+repr(args)+'\\n')
def safe(value):
    p = pathlib.Path(value)
    assert p.is_absolute() and p.is_relative_to(root), value
    return p
if name == 'unshare': sys.exit(int(os.environ['HOOK_NO_USERNS']))
elif name == 'ischroot': sys.exit(1)
elif name == 'apparmor_parser':
    sys.exit(1 if '--skip-kernel-load' in args and os.environ['HOOK_NO_AA']=='1' else 0)
elif name == 'chmod' and args[0] == '-R':
    assert args[1] == 'a+rX', args
    top = safe(args[2])
    for path in [top, *top.rglob('*')]:
        if path.is_symlink(): continue
        mode = path.stat().st_mode
        extra = 0o444 | (0o111 if path.is_dir() or mode & 0o111 else 0)
        path.chmod((mode | extra) & 0o7777)
elif name == 'chmod': safe(args[1]).chmod(int(args[0], 8))
elif name in ['cp', 'install']:
    src, dest = safe(args[-2]), safe(args[-1]); dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
elif name == 'rm':
    for value in args:
        if not value.startswith('-'): safe(value).unlink(missing_ok=True)
elif name == 'readlink':
    path = safe(args[0])
    if not path.is_symlink(): sys.exit(1)
    print(os.readlink(path))
elif name == 'ln':
    src, dest = safe(args[-2]), safe(args[-1]); dest.parent.mkdir(parents=True, exist_ok=True)
    dest.unlink(missing_ok=True); dest.symlink_to(src)
elif name not in ['update-alternatives','update-mime-database','update-desktop-database','apparmor_status','udevadm']:
    raise AssertionError(name)
'''
    for case, no_userns, no_aa in [('userns', '0', '0'), ('suid', '1', '0'), ('older-apparmor', '0', '1')]:
        fake = workspace / case
        bins = fake / 'stubs'; bins.mkdir(parents=True)
        log = fake / 'commands.log'; log.touch()
        stub = bins / 'stub'; stub.write_text(f'#!{sys.executable}\n' + stub_code); stub.chmod(0o755)
        for name in ['update-alternatives','unshare','chmod','update-mime-database','update-desktop-database',
                     'apparmor_status','apparmor_parser','cp','install','udevadm','rm','ln','readlink','ischroot']:
            (bins / name).symlink_to(stub)
        install = fake / 'opt' / meta['productName']
        (install / 'resources/linux').mkdir(parents=True)
        shutil.copyfile(app / 'resources/apparmor-profile', install / 'resources/apparmor-profile')
        shutil.copyfile(app / 'resources/linux/70-platinum-md-netmd.rules', install / 'resources/linux/70-platinum-md-netmd.rules')
        (install / 'chrome-sandbox').touch()
        # An upgrade over an old build leaves its owner-only folders in place.
        (install / 'resources').chmod(0o700)
        install.chmod(0o700)
        (fake / 'usr/bin').mkdir(parents=True)
        (fake / 'usr/bin/ischroot').symlink_to(bins / 'ischroot')
        # Model the namespace link inside the isolated test, rather than
        # letting this build workspace's /proc decide which branch is tested.
        namespace = fake / 'proc/self/ns/user'
        namespace.parent.mkdir(parents=True)
        (fake / 'namespace-placeholder').touch()
        namespace.symlink_to(fake / 'namespace-placeholder')
        hooks = {}
        for name in ['postinst', 'postrm']:
            text = (control / name).read_text()
            assert '${' not in text, 'Unexpanded installer template.'
            hook = fake / name
            text = re.sub(r'/(opt|etc|usr)/', lambda m: str(fake / m[1]) + '/', text)
            hook.write_text(text.replace('/proc/self/ns/user', str(namespace)))
            run('bash', '-n', hook)
            hooks[name] = hook
        env = dict(os.environ, PATH=str(bins), HOOK_ROOT=str(fake), HOOK_LOG=str(log),
                   HOOK_NO_USERNS=no_userns, HOOK_NO_AA=no_aa)
        # Repeat configuration to exercise package upgrades/reconfiguration.
        for _ in range(2): run('/bin/bash', hooks['postinst'], 'configure', env=env)
        for folder in [install, install / 'resources', install / 'resources/linux']:
            assert folder.stat().st_mode & 0o555 == 0o555, (case, folder, oct(folder.stat().st_mode))
        actual_mode = (install / 'chrome-sandbox').stat().st_mode & 0o7777
        assert actual_mode == (0o4755 if no_userns == '1' else 0o755), (case, oct(actual_mode), log.read_text())
        rules = fake / 'usr/lib/udev/rules.d/70-platinum-md-next.rules'
        profile = fake / 'etc/apparmor.d/platinum-md-next'
        assert rules.is_file()
        assert profile.exists() == (no_aa == '0')
        before = log.read_text()
        run('/bin/bash', hooks['postinst'], 'abort-upgrade', env=env)
        run('/bin/bash', hooks['postrm'], 'upgrade', env=env)
        assert log.read_text() == before and rules.is_file(), 'Upgrade removed the new installation.'
        for action in ['remove', 'purge']:
            run('/bin/bash', hooks['postrm'], action, env=env)
        assert not rules.exists() and not profile.exists()
    print('Installer scripts: repeated configure, upgrade guards, remove/purge, sandbox modes and AppArmor branches passed in isolated simulations.')


version = run('dpkg-deb', '--field', archive, 'Version').strip()
assert version == f'{meta["debianEpoch"]}:{meta["version"]}'
assert run('dpkg-deb', '--field', archive, 'Architecture').strip() == 'amd64'
assert 'libc6 (>= 2.35)' in run('dpkg-deb', '--field', archive, 'Depends')
for previous in ['2.0.0~alpha.2', '2.0.0~alpha.10', '1:1.0.0']:
    run('dpkg', '--compare-versions', version, 'gt', previous)
archive_modes = {}
with subprocess.Popen(['dpkg-deb', '--fsys-tarfile', str(archive)], stdout=subprocess.PIPE) as process:
    with tarfile.open(fileobj=process.stdout, mode='r|') as tar:
        for member in tar:
            assert member.uid == member.gid == 0, member.name
            assert '..' not in Path(member.name).parts and not Path(member.name).is_absolute()
            # dpkg installs these root-owned paths. A build-time 0700 folder
            # must never make the desktop executable inaccessible to users.
            if member.isdir():
                assert member.mode & 0o005 == 0o005, f'Users cannot list/traverse {member.name}: {oct(member.mode)}'
            elif member.isfile():
                assert member.mode & 0o004, f'Users cannot read {member.name}: {oct(member.mode)}'
            archive_modes[Path(member.name).as_posix()] = member.mode & 0o7777
    assert process.wait() == 0
with tempfile.TemporaryDirectory(prefix='platinum deb check space ') as temporary:
    workspace = Path(temporary)
    extracted = workspace / 'extracted'
    run('dpkg-deb', '--raw-extract', archive, extracted)
    app = extracted / 'opt' / meta['productName']
    docs = extracted / 'usr/share/doc' / meta['name']
    manifest = json.loads((docs / 'release.json').read_text())
    assert manifest['version'] == meta['version'] and manifest['debVersion'] == version
    assert manifest['commit'] == run('git', 'rev-parse', 'HEAD', cwd=ROOT).strip()
    for name, entry in manifest['files'].items():
        file = extracted / name
        assert file.stat().st_size == entry['size'] and digest(file) == entry['sha256'], name
        # Installation permissions are defined by the archive, independently
        # of a host's extraction policy or temporary filesystem.
        assert archive_modes[name] == entry['mode'], name
    run('md5sum', '--check', '--quiet', extracted / 'DEBIAN/md5sums', cwd=extracted)
    validate_app(app)
    bundle = docs / 'source/Platinum-MD-Next.bundle'
    run('git', 'bundle', 'verify', bundle, cwd=ROOT)
    assert f'{manifest["commit"]} HEAD' in run('git', 'bundle', 'list-heads', bundle)
    desktop = (extracted / 'usr/share/applications' / meta['desktopName']).read_text()
    assert 'Exec="/opt/Platinum-MD Next/platinum-md-next" %U' in desktop
    icon = extracted / 'usr/share/icons/hicolor/256x256/apps/platinum-md-next.png'
    assert icon.read_bytes() == (ROOT / 'build/icons/256x256.png').read_bytes()
    assert icon.read_bytes() == (ROOT / 'static/icons/256x256.png').read_bytes(), 'Launcher and window icons differ.'
    rules = (extracted / 'usr/lib/udev/rules.d/70-platinum-md-next.rules').read_text()
    assert 'ATTR{idVendor}=="054c", ATTR{idProduct}=="00c7", TAG+="uaccess"' in rules
    assert '0666' not in rules and 'MODE=' not in rules
    env = dict(os.environ, LC_ALL='C', LD_LIBRARY_PATH=str(app / 'resources/native/lib'))
    for name, args in [('netmdcli', ['help']), ('ffmpeg', ['-version']), ('ffprobe', ['-version']),
                       ('atracdenc', ['-h']), ('cdparanoia', ['-V'])]:
        run(app / 'resources/native/bin' / name, *args, env=env, timeout=15)
    if options.skip_electron_startup:
        print('Electron startup: explicitly skipped; runtime startup remains unverified in this workspace.')
    else:
        actual = run(app / meta['name'], '-p', 'process.versions.electron',
                     env=dict(os.environ, ELECTRON_RUN_AS_NODE='1'), timeout=15).strip()
        assert actual == meta['devDependencies']['electron']
        print('Electron Node startup passed.')
    # /opt, /etc and /usr have no spaces. Keep the replacement prefixes that
    # way too; the real product path still contains 'Platinum-MD Next'.
    with tempfile.TemporaryDirectory(prefix='platinum-deb-hooks-') as hooks_folder:
        hooks_root = Path(hooks_folder)
        assert not any(c.isspace() for c in str(hooks_root)), 'Use a TMPDIR without spaces for hook simulations.'
        check_hooks(extracted / 'DEBIAN', app, hooks_root)
    print(f'Debian package: {len(manifest["files"])} payload files verified; normal-user access, root ownership, upgrade ordering, source and five helpers passed.')
    print('No host installation, graphical desktop or hardware test is claimed.')
