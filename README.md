# SpectralDiff

> **See what changed in the sound.**
> A spectral microscope for audio.

SpectralDiff is a professional desktop tool for musicians, audio engineers, and researchers to visualize, inspect, and quantitatively compare the spectral content of audio files.

While standard spectrogram tools like Spek simply show you the spectrum, SpectralDiff lets you **investigate** it.

## Features

- **High-Performance Spectrogram**: Fast, native rendering of STFT using NumPy and PyQtGraph.
- **FFT Inspector**: Hover over any point in time to instantly see the exact FFT frame, resolving the actual frequencies and DBFS levels present at that millisecond.
- **A/B Comparison**: Load an original master and a remaster, a FLAC and an MP3, or two different codecs. SpectralDiff will attempt to automatically align them in time and gain, and then compute the exact difference.
- **Difference Spectrogram**: Visualize `A - B` to immediately spot where a codec threw away information or where an EQ shelf was applied.
- **Quantitative Diagnostics**:
    - **Effective Bandwidth**: Determines where the actual audio energy ends.
    - **Cutoff Detection**: Identifies steep brickwall cutoffs often caused by lossy compression.
    - **Lossy Source Detection**: Employs heuristics to detect if a "lossless" FLAC was transcoded from an MP3.

## Why SpectralDiff?

When analyzing audio, you often want to know what changed. Is this Hi-Res file actually just upsampled from 44.1kHz? Did the streaming service's transcoder alter the high frequencies? What exactly did that analog mastering chain do to the frequency response?

SpectralDiff gives you the evidence you need to answer these questions without relying on subjective listening alone or trusting opaque "quality score" algorithms.

## Building and Running

### Prerequisites
- Python 3.10+
- `pip install pyqt6 pyqtgraph numpy scipy soundfile librosa`

### Running
```bash
python spectraldiff/main.py
```

## Architecture

SpectralDiff uses a modular design:
- `core/audio.py`: Handles multi-format audio decoding using `soundfile`.
- `core/stft.py`: Provides highly optimized Short-Time Fourier Transform processing via `librosa`, properly normalized to dBFS.
- `core/compare.py`: Employs cross-correlation to align two audio signals with sub-second precision, accounting for delays and gain differences.
- `core/diagnostics.py`: Statistical algorithms that evaluate the STFT data over time to estimate effective bandwidth and detect persistent cutoffs.
- `ui/`: Fast OpenGL-accelerated GUI built on PyQt6 and PyQtGraph.

## License
MIT License
