#!/usr/bin/env python3
"""Create an original 30-second stereo WAV for the first SP recording test.

Seconds 0–10: left channel. 10–20: right channel. 20–30: both channels.
Soft, one-second notes have short fades and peak below -18 dBFS.
No speech, third-party recordings or external Python packages are used.
"""
from array import array
import math
from pathlib import Path
import sys
import wave

rate = 44100
duration = 30
notes = (261.625565, 329.627557, 391.995436, 523.251131, 391.995436)
samples = array('h')
for index in range(rate * duration):
    second, within = divmod(index, rate)
    position = within / rate
    envelope = max(0.0, min(1.0, position / 0.02, (0.85 - position) / 0.04))
    tone = round(3500 * envelope * math.sin(2 * math.pi * notes[second % len(notes)] * position))
    samples.extend((tone if second < 10 or second >= 20 else 0,
                    tone if second >= 10 else 0))
assert max(abs(value) for value in samples) <= 3500
if sys.byteorder != 'little':
    samples.byteswap()
output = Path(__file__).resolve().parent.parent / 'release' / 'Platinum-SP-Test-30s.wav'
output.parent.mkdir(exist_ok=True)
with wave.open(str(output), 'wb') as audio:
    audio.setparams((2, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(samples.tobytes())
print(output)
