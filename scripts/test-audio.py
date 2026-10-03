#!/usr/bin/env python3
"""Exercise the actual SP/LP2/LP4 conversion chain without a recorder."""
from pathlib import Path
import json
import math
import os
import struct
import subprocess
import tempfile
import wave

root = Path(__file__).resolve().parent.parent
env = dict(os.environ, LC_ALL='C')
env['LD_LIBRARY_PATH'] = str(root / 'native/lib')


def run(name, *args):
    return subprocess.run([str(root / 'native/bin' / name), *map(str, args)], env=env,
                          capture_output=True, text=True, timeout=60, check=True).stdout


def wave_format(file):
    data = file.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE', file
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        size = struct.unpack_from('<I', data, offset + 4)[0]
        if kind == b'fmt ':
            return struct.unpack_from('<HHIIHH', data, offset + 8)
        offset += 8 + size + (size % 2)
    raise AssertionError('No fmt chunk')


with tempfile.TemporaryDirectory(prefix='platinum-audio-test-') as folder:
    folder = Path(folder)
    original, pcm = folder / 'stereo-48k.wav', folder / 'sp.wav'
    with wave.open(str(original), 'wb') as audio:
        audio.setparams((2, 2, 48000, 0, 'NONE', 'not compressed'))
        audio.writeframes(b''.join(struct.pack('<hh', int(9000 * math.sin(2 * math.pi * 440 * i / 48000)),
            int(7000 * math.sin(2 * math.pi * 660 * i / 48000))) for i in range(48000 * 3)))
    run('ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', original,
        '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', pcm)
    for mode, bitrate, block in [('SP', None, 4), ('LP2', '128', 384), ('LP4', '64', 192)]:
        output = pcm
        if bitrate:
            output = folder / (mode + '.at3')
            run('atracdenc', '-e', 'atrac3', '-i', pcm, '-o', output, '--container', 'riff', '--bitrate', bitrate)
        tag, channels, rate, _, alignment, _ = wave_format(output)
        assert (tag, channels, rate, alignment) == (0x270 if bitrate else 1, 2, 44100, block)
        info = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', output))
        assert info['streams'][0]['codec_name'] == ('atrac3' if bitrate else 'pcm_s16le')
        assert 2.9 < float(info['format']['duration']) < 3.2
        print(mode + ': codec, stereo, 44.1 kHz, RIFF block alignment and duration verified')
