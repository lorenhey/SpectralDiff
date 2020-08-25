import unittest
import numpy as np
from spectraldiff.core.compare import align_signals
from spectraldiff.core.diagnostics import get_effective_bandwidth

class TestDSP(unittest.TestCase):
    def test_alignment_zero_offset(self):
        sr = 48000
        a = np.random.randn(sr * 2)
        offset, gain_db, pol = align_signals(a, a, sr)
        self.assertEqual(offset, 0)
        self.assertAlmostEqual(gain_db, 0.0, places=2)
        self.assertEqual(pol, 1.0)
        
    def test_alignment_positive_offset(self):
        sr = 48000
        a = np.random.randn(sr * 2)
        # B is shifted forward by 100 samples
        b = np.pad(a, (100, 0))[:-100]
        offset, gain_db, pol = align_signals(a, b, sr)
        # Cross correlation of A with B (A is ref, B is tgt). 
        # B is delayed, so the peak in corr(A, B) should be at a negative lag or positive lag depending on correlate mode
        self.assertEqual(offset, -100)

    def test_alignment_polarity_and_gain(self):
        sr = 48000
        a = np.random.randn(sr * 2)
        b = -0.5 * a
        offset, gain_db, pol = align_signals(a, b, sr)
        self.assertEqual(offset, 0)
        self.assertEqual(pol, -1.0)
        # Gain is RMS(A)/RMS(B) = 1 / 0.5 = 2.0. In dB: 20 * log10(2) = 6.02
        self.assertAlmostEqual(gain_db, 6.02, places=2)

if __name__ == '__main__':
    unittest.main()
