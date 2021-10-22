from setuptools import setup, find_packages

setup(
    name="spectraldiff",
    version="0.1.0",
    description="A spectral microscope for audio.",
    author="SpectralDiff Contributors",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.24.0",
        "scipy>=1.11.0",
        "soundfile>=0.12.1",
        "librosa>=0.10.0",
        "PyQt6>=6.5.0",
        "pyqtgraph>=0.13.0",
    ],
    entry_points={
        "console_scripts": [
            "spectraldiff=spectraldiff.main:main",
        ],
    },
)
