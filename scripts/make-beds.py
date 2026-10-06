"""Turn the raw CC0 recordings in assets/beds/source/ into seamless, loudness-matched
loop MP3s in assets/beds/. Not part of the app build; re-run only when changing beds.

Usage (needs numpy + imageio-ffmpeg, e.g. `pip install --target <dir> numpy imageio-ffmpeg`
and PYTHONPATH=<dir>):  python scripts/make-beds.py

Loop technique: output = clip[X:L-X] + equal-power-crossfade(clip[L-X:L] -> clip[0:X]).
The last sample then flows into clip[X], which is the first sample of the output.
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
ROOT = Path(__file__).resolve().parent.parent / "assets" / "beds"
SRC = ROOT / "source"
TARGET_RMS_DB = -28.0  # same level for every bed so the balance slider means the same thing
PEAK_CEIL = 0.89       # ~ -1 dBFS

# id -> (source file, start offset s, max length s or None, crossfade s)
BEDS = {
    "rain": ("rain.wav", 0, 45, 3),  # vehicle audible from ~46s, so cut at 45s
    "ocean": ("ocean.wav", 0, None, 4),
    "crickets": ("night crickets.wav", 0, None, 4),
    "pad": ("Ambient F sharp (soft pad).wav", 10, 120, 8),
}


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def make_loop(a: np.ndarray, x: int) -> np.ndarray:
    t = np.linspace(0, np.pi / 2, x, dtype=np.float32)[:, None]
    blend = a[-x:] * np.cos(t) + a[:x] * np.sin(t)
    return np.concatenate([a[x:-x], blend])


def normalize(a: np.ndarray) -> np.ndarray:
    rms = np.sqrt(np.mean(a ** 2))
    gain = 10 ** (TARGET_RMS_DB / 20) / rms
    peak = np.max(np.abs(a)) * gain
    if peak > PEAK_CEIL:
        gain *= PEAK_CEIL / peak
    return a * gain


for bed_id, (src, start, max_len, xfade) in BEDS.items():
    a = decode(SRC / src)[start * SR:]
    if max_len:
        a = a[: max_len * SR]
    loop = normalize(make_loop(a, xfade * SR))
    out = ROOT / f"{bed_id}.mp3"
    subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", "96k", str(out)],
        input=loop.astype(np.float32).tobytes(), check=True,
    )
    print(f"{bed_id}: {len(loop) / SR:.1f}s, {out.stat().st_size / 1e6:.2f} MB")
