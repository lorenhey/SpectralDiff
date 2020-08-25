# SpectralDiff Architecture

SpectralDiff is designed as a fast, maintainable, and scientifically accurate desktop application.
The tech stack chosen is **Python 3**, using **PyQt6** and **PyQtGraph** for the frontend, and **NumPy/SciPy/Librosa** for the DSP backend.

## Why this stack?
The user explicitly asked to evaluate technologies like Rust, C++, PyQt, Tauri, etc., but requested to "not choose a technology just for fashion" and to ensure it has a "clear separation between DSP and UI" while handling "huge files quickly".

While Rust is exceptionally fast for the backend, developing a custom scientific visualization UI from scratch (or via egui) to handle extremely complex interactive spectrograms, multiresolution zoom, and A/B cross-correlation alignment is very time-consuming. Python, combined with `pyqtgraph` (which uses OpenGL natively to draw millions of data points efficiently) and `numpy` (which binds directly to optimized C/Fortran LAPACK and BLAS libraries for FFT and DSP), provides the exact same computational speed for DSP operations while making the UI iteration significantly more robust and maintainable. The heavy lifting (FFT, cross-correlation) is entirely done in C code under the hood.

## Core Modules

### `audio.py`
Handles reading audio files across multiple formats using `soundfile`. It extracts basic metadata and reads the data into `float32` arrays, normalized from -1.0 to 1.0. It also computes a SHA-256 hash for reproducibility.

### `stft.py`
The heart of the spectral analysis. It uses `librosa.stft` to compute the Short-Time Fourier Transform. Crucially, it normalizes the magnitude output based on the chosen window function (Hann, Hamming, Blackman, etc.) so that the resulting amplitudes accurately reflect physical levels (dBFS).

### `compare.py`
Implements the signal alignment and residual calculations.
When a user loads Track A and Track B, `compare.py` uses cross-correlation to find the exact sub-sample offset between the two signals. It then estimates the gain difference by comparing RMS power, aligning Track B to Track A in both time and amplitude. This makes a true "Null Test" or difference spectrogram mathematically sound.

### `diagnostics.py`
Heuristics and measurements.
- **Effective Bandwidth**: Finds the highest frequency bin that contains energy above a noise floor.
- **Cutoff Detection**: Identifies steep brick-wall filters (e.g. at 16kHz or 20kHz) typical of MP3/AAC encoders, allowing the application to estimate if a lossless file was transcoded from a lossy source.

## UI Layer
- `main_window.py`: Orchestrates the flow, manages the splitters, and holds the logic for triggering re-computation when FFT parameters change.
- `spectrogram_widget.py`: A `pyqtgraph.ImageItem` based widget that renders the STFT magnitude matrix. It uses a perceptually uniform colormap (`magma`) to accurately represent energy levels without misleading the eye (unlike typical "rainbow" colormaps).
- `inspector_widget.py`: A line plot that updates in real-time as the user hovers over the spectrogram, showing the exact frequency response of that specific time frame.
- `average_spectrum_widget.py`: Calculates and displays the mean and peak spectrum across the entire track, plotting it on a logarithmic frequency axis.
