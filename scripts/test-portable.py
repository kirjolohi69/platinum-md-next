#!/usr/bin/env python3
"""Check launcher recovery and optionally the actual complete release ZIP."""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('portable', ROOT / 'scripts/portable-launcher.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='portable test space ')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'Fresh application folder'
        (self.root / 'app/resources/native/bin').mkdir(parents=True)
        self.executable = self.root / 'app/platinum-md-next'
        self.executable.write_text('#!/bin/sh\necho "simulated desktop error"\nexit 7\n')
        (self.root / 'app/resources/app.asar').write_bytes(b'fixture app')
        self.helper = self.root / 'app/resources/native/bin/ffmpeg'
        self.helper.write_bytes(b'fixture helper')
        self.manifest = {'format': 1, 'version': '2.0.0-fixture', 'files': {}}
        for file in [self.executable, self.helper, self.root / 'app/resources/app.asar']:
            self.manifest['files'][file.relative_to(self.root).as_posix()] = {
                'sha256': launcher.digest(file), 'size': file.stat().st_size,
                'executable': file in [self.executable, self.helper]}
        (self.root / 'portable.json').write_text(json.dumps(self.manifest))
        shutil.copyfile(ROOT / 'scripts/Start-Portable.sh', self.root / 'Start-Platinum-MD.sh')
        shutil.copyfile(ROOT / 'scripts/portable-launcher.py', self.root / 'start-platinum.py')

    def test_fresh_folder_spaces_and_lost_execute_permissions(self):
        result = subprocess.run(['bash', str(self.root / 'Start-Platinum-MD.sh'), '--check'],
                                cwd=self.root.parent, capture_output=True, text=True, check=True)
        self.assertIn('No older downloads are needed', result.stdout)
        self.assertTrue(os.access(self.executable, os.X_OK))
        self.assertTrue(os.access(self.helper, os.X_OK))
        self.assertFalse(os.access(self.root / 'app/resources/app.asar', os.X_OK))

    def test_corrupt_helper_stops_before_any_permissions_change(self):
        self.helper.write_bytes(b'x' * self.helper.stat().st_size)
        with self.assertRaisesRegex(RuntimeError, 'missing or damaged'):
            launcher.verify(self.root, self.manifest)
        self.assertFalse(os.access(self.executable, os.X_OK))

    def test_missing_runtime_is_rejected(self):
        self.executable.unlink()
        with self.assertRaisesRegex(RuntimeError, 'missing or damaged'):
            launcher.verify(self.root, self.manifest)

    def test_incomplete_manifest_is_rejected(self):
        del self.manifest['files']['app/resources/app.asar']
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            launcher.verify(self.root, self.manifest)

    def test_parent_path_cannot_escape(self):
        for name in ['app/../../outside', '/outside', 'app/..\\outside']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                launcher.inside(self.root, name)

    def test_symlink_cannot_change_or_launch_outside_files(self):
        outside = self.root.parent / 'outside'
        outside.write_bytes(self.helper.read_bytes())
        self.helper.unlink()
        self.helper.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'outside'):
            launcher.verify(self.root, self.manifest)
        self.assertFalse(os.access(outside, os.X_OK))

    def test_failed_launch_retains_actionable_report(self):
        with mock.patch.object(launcher, '__file__', str(self.root / 'start-platinum.py')), \
                mock.patch.object(launcher.os, 'geteuid', return_value=1000), \
                mock.patch('sys.argv', ['start-platinum.py']), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(launcher.main(), 1)
        reports = list(self.root.glob('startup-report-*.txt'))
        self.assertEqual(len(reports), 1)
        self.assertIn('simulated desktop error', reports[0].read_text())
        self.assertIn('exit code: 7', reports[0].read_text())

    def test_root_launch_refused_without_running_any_process(self):
        with mock.patch.object(launcher.os, 'geteuid', return_value=0), \
                mock.patch('sys.argv', ['start-platinum.py']), mock.patch.object(launcher.subprocess, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'without sudo'):
                launcher.main()
            run.assert_not_called()


def check_archive():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    expected_folder = f'Platinum-MD-Next-{version}-linux-x64'
    with tempfile.TemporaryDirectory(prefix='portable actual extraction space ') as temporary:
        temporary = Path(temporary)
        with zipfile.ZipFile(ROOT / 'release' / f'{expected_folder}.zip') as archive:
            for entry in archive.infolist():
                path = Path(entry.filename)
                assert not path.is_absolute() and '..' not in path.parts and path.parts[0] == expected_folder
            archive.extractall(temporary)  # Deliberately loses executable bits.
        folder = temporary / expected_folder
        subprocess.run(['bash', str(folder / 'Start-Platinum-MD.sh'), '--check'], cwd=temporary, check=True)
        manifest = json.loads((folder / 'portable.json').read_text())
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        assert manifest['version'] == version and manifest['commit'] == commit
        bundle = folder / 'source/Platinum-MD-Next.bundle'
        assert f'{commit} HEAD' in subprocess.check_output(['git', 'bundle', 'list-heads', str(bundle)], text=True)
        subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=ROOT, check=True, capture_output=True)
        native = folder / 'app/resources/native'
        env = dict(os.environ, LC_ALL='C', LD_LIBRARY_PATH=str(native / 'lib'))
        for name, args in [('netmdcli', ['help']), ('ffmpeg', ['-version']), ('ffprobe', ['-version']),
                           ('atracdenc', ['-h']), ('cdparanoia', ['-V'])]:
            result = subprocess.run([str(native / 'bin' / name), *args], env=env, capture_output=True, text=True, timeout=15)
            assert result.returncode == 0, (name, result.stderr)
        result = subprocess.run([str(folder / 'app/platinum-md-next'), '-p', 'process.versions.electron'],
            env=dict(os.environ, ELECTRON_RUN_AS_NODE='1'), capture_output=True, text=True, check=True, timeout=15)
        assert result.stdout.strip() == json.loads((ROOT / 'package.json').read_text())['devDependencies']['electron']
        print(f'Actual standalone ZIP: {len(manifest["files"])} files verified in a fresh path with spaces;')
        print('five helpers and Electron Node mode start; source history matches. No GUI or hardware test claimed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--built', action='store_true')
    args = parser.parse_args()
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(LauncherTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.built:
        check_archive()
