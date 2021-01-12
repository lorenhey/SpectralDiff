import numpy as np
from scipy.signal import correlate

def align_signals(ref_data, target_data, sample_rate, max_offset_sec=10.0):
    """
    Aligns target_data to ref_data using cross-correlation.
    Returns (offset_samples, gain_db, polarity).
    """
    N_check = min(len(ref_data), len(target_data), int(max_offset_sec * sample_rate))
    
    ref_slice = ref_data[:N_check]
    tgt_slice = target_data[:N_check]
    
    if len(ref_slice) == 0 or len(tgt_slice) == 0:
        return 0, 0.0, 1.0

    # Cross correlation
    corr = correlate(ref_slice, tgt_slice, mode='full')
    lags = np.arange(-N_check + 1, N_check)
    
    peak_idx = np.argmax(np.abs(corr))
    best_lag = lags[peak_idx]
    
    polarity = np.sign(corr[peak_idx])
    
    rms_ref = np.sqrt(np.mean(ref_slice**2))
    rms_tgt = np.sqrt(np.mean(tgt_slice**2))
    
    gain_linear = (rms_ref / rms_tgt) if rms_tgt > 1e-10 else 1.0
    gain_db = 20 * np.log10(gain_linear)
    
    return best_lag, gain_db, polarity

def calculate_difference_spectrogram(S_ref, S_tgt):
    """
    S_ref and S_tgt are magnitude STFTs (linear, not dB).
    Returns Delta in dB.
    """
    eps = 1e-10
    delta = 20 * np.log10((np.abs(S_tgt) + eps) / (np.abs(S_ref) + eps))
    return delta
def calculate_residual(ref_data, tgt_aligned):
    """
    Returns time-domain residual and its RMS in dBFS.
    """
    res = ref_data - tgt_aligned
    rms = np.sqrt(np.mean(res**2))
    rms_db = 20 * np.log10(rms) if rms > 1e-10 else -120.0
    return res, rms_db
