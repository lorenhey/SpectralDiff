# Contributing to SpectralDiff

First, thank you for your interest! SpectralDiff aims to be a robust, mathematically sound audio analysis tool. 

## Philosophy
Before contributing, please read the README and `architecture.md`. We prioritize:
1. **Evidence over Verdicts**: If adding a diagnostic feature, ensure it reports what it measures, not an absolute truth.
2. **Performance**: DSP code should leverage `numpy` vectorization. Do not write pure Python loops for millions of samples.
3. **UI Restraint**: The interface should look like a laboratory instrument, not a generic web app. Avoid unnecessary animations, rounded corners, or "modern" fluff.

## Development Setup
```bash
git clone https://github.com/yourusername/SpectralDiff.git
cd SpectralDiff
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Running Tests
Always ensure tests pass before submitting a PR.
```bash
python -m unittest discover -s tests
```
If you add a new DSP feature (e.g. a new metric), add a test in `tests/test_dsp.py` against a synthetically generated known signal (golden file).

## Pull Requests
- Keep PRs focused. Do not mix refactoring with feature additions.
- Ensure type hints are used where appropriate.
- Document any mathematical formulas used in `docs/` or docstrings.
