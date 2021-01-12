import numpy as np

def detect_spectral_cutoff(stft_mag_db, freqs, threshold_db=-90, persistence_ratio=0.9):
    """
    Looks for a sudden drop in energy at high frequencies across time frames.
    stft_mag_db: shape (freq_bins, time_frames)
    """
    mean_spectrum = np.mean(stft_mag_db, axis=1)
    
    cutoff_freq = None
    cutoff_idx = -1
    
    for i in range(len(freqs)-1, 0, -1):
        if mean_spectrum[i] > threshold_db:
            if i < len(freqs) - 5: # If it's noticeably below Nyquist
                cutoff_idx = i
                cutoff_freq = freqs[i]
            break
            
    if cutoff_freq is not None and cutoff_idx != -1:
        # Calculate persistence: how many frames actually lack energy above this cutoff?
        # A true cutoff means almost all frames have NO energy above this point.
        above_cutoff = stft_mag_db[cutoff_idx+2:, :]
        if above_cutoff.shape[0] > 0:
            frames_with_energy = np.sum(np.max(above_cutoff, axis=0) > (threshold_db + 10))
            persistence = 1.0 - (frames_with_energy / stft_mag_db.shape[1])
            
            # Additional heuristic: checking the slope
            # If the drop is very steep, it's more likely a codec filter
            return cutoff_freq, persistence, np.mean(mean_spectrum[cutoff_idx+2:])
            
    return None, 0.0, -120.0

def get_effective_bandwidth(mean_spectrum, freqs, threshold_db=-90):
    for i in range(len(freqs)-1, 0, -1):
        if mean_spectrum[i] > threshold_db:
            return freqs[i]
    return 0.0
