import unittest
import numpy as np
from spectraldiff.core.diagnostics import detect_spectral_cutoff, get_effective_bandwidth

class TestSpectralCutoff(unittest.TestCase):
    def test_effective_bandwidth_full(self):
        freqs = np.linspace(0, 24000, 256)
        mean_spec = np.zeros(256)
        mean_spec[:200] = -30.0 # energy up to ~18.8 kHz
        mean_spec[200:] = -95.0 # silence above
        
        bw = get_effective_bandwidth(mean_spec, freqs, threshold_db=-85)
        self.assertAlmostEqual(bw, freqs[199], places=1)

    def test_cutoff_detection_brickwall(self):
        num_bins = 256
        num_frames = 50
        freqs = np.linspace(0, 24000, num_bins)
        
        # Simulate STFT with brickwall at index 170 (~16 kHz)
        stft_db = np.ones((num_bins, num_frames)) * -110.0
        stft_db[:170, :] = -25.0 # Signal below cutoff
        
        cutoff_f, persistence, mean_above = detect_spectral_cutoff(stft_db, freqs, threshold_db=-85)
        self.assertIsNotNone(cutoff_f)
        self.assertAlmostEqual(cutoff_f, freqs[169], places=1)
        self.assertGreater(persistence, 0.9)
        self.assertLess(mean_above, -100.0)

if __name__ == '__main__':
    unittest.main()
