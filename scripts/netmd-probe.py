#!/usr/bin/env python3
"""Read a NetMD disc listing and save diagnostics, without writing to the disc."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    version_path = ROOT / 'version.json'
    if not version_path.is_file():
        version_path = ROOT / 'package.json'
    version = json.loads(version_path.read_text())['version']
    report = {'test': 'Platinum-MD Next connection test', 'version': version,
              'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'architecture': platform.machine(),
              'devices': [], 'success': False}
    print('Platinum-MD Next connection test ' + version)
    print('Close other MiniDisc apps. This test reads the disc; it does not record, rename or delete tracks.')
    print('A connection attempt can take up to 45 seconds.')
    try:
        report['helperSha256'] = hashlib.sha256((ROOT / 'native/bin/netmdcli').read_bytes()).hexdigest()
        if sys.platform != 'linux' or platform.machine() != 'x86_64':
            raise RuntimeError('This test build requires x86_64 Linux (Ubuntu 24.04 / Mint 22 or newer).')
        known = json.loads((ROOT / 'app/devices.json').read_text())
        if not Path('/sys/bus/usb/devices').is_dir():
            raise RuntimeError('Linux USB devices are not visible in this environment. Run the test on the desktop where your recorder is connected.')
        for entry in sorted(Path('/sys/bus/usb/devices').iterdir()):
            try:
                identity = (entry / 'idVendor').read_text().strip() + ':' + (entry / 'idProduct').read_text().strip()
                if identity not in known:
                    continue
                bus = int((entry / 'busnum').read_text())
                number = int((entry / 'devnum').read_text())
                node = Path(f'/dev/bus/usb/{bus:03d}/{number:03d}')
                report['devices'].append({'id': identity, 'model': known[identity],
                    'node': str(node), 'writable': os.access(node, os.R_OK | os.W_OK)})
            except (OSError, ValueError):
                continue
        if not report['devices']:
            raise RuntimeError('No supported NetMD recorder detected. Connect it with a disc inserted, then retry.')
        if len(report['devices']) != 1:
            raise RuntimeError('Connect one NetMD recorder at a time.')
        device = report['devices'][0]
        print(f"Found {device['model']} ({device['id']}).")
        if not device['writable']:
            raise RuntimeError('USB access is blocked for this account. An administrator can install the included USB rule once. Run the test as your normal user.')
        print('USB read/write access is available. Reading disc information…')
        env = dict(os.environ, LC_ALL='C')
        env['LD_LIBRARY_PATH'] = str(ROOT / 'native/lib') + (':' + env['LD_LIBRARY_PATH'] if env.get('LD_LIBRARY_PATH') else '')
        trace = '--trace' in sys.argv[1:]
        if trace:
            env['LIBUSB_DEBUG'] = '4'
        try:
            result = subprocess.run([str(ROOT / 'native/bin/netmdcli'), '-t' if trace else '-v'],
                                    env=env, capture_output=True, timeout=45)
            report.update(exitCode=result.returncode, stdout=result.stdout.decode('utf-8', 'replace'),
                          stderr=result.stderr.decode('utf-8', 'replace'))
        except subprocess.TimeoutExpired as error:
            report.update(stdout=(error.stdout or b'').decode('utf-8', 'replace'),
                          stderr=(error.stderr or b'').decode('utf-8', 'replace'))
            raise RuntimeError('The connection timed out after 45 seconds. The report contains the last completed stage.')
        if result.returncode:
            raise RuntimeError('The NetMD helper could not read the disc. The report contains its error output.')
        disc = json.loads(report['stdout'])
        if not isinstance(disc.get('tracks'), list) or not disc.get('totalTime') or disc['totalTime'] == '00:00:00.00':
            raise RuntimeError('The recorder returned incomplete disc information.')
        report.update(success=True, disc=disc)
        print(f"Success: read {len(disc['tracks'])} track(s). No tracks were modified.")
    except Exception as error:
        report['error'] = str(error)
        print(str(error), file=sys.stderr)
    # A unique file prevents accidental overwriting of an earlier report.
    output_dir = Path.cwd()
    try:
        with tempfile.NamedTemporaryFile(mode='w', prefix='netmd-report-', suffix='.txt',
                                         dir=output_dir, delete=False, encoding='utf-8') as output:
            json.dump(report, output, indent=2)
            output.write('\n')
        print('\nReport saved to: ' + output.name)
        print('Reports can contain disc titles and track names. Review before sharing publicly.')
    except OSError as error:
        print('Could not save the report: ' + str(error), file=sys.stderr)
        return 1
    return 0 if report['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
