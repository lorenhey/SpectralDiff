import numpy as np
import librosa
from scipy.signal import get_window

def compute_stft(audio_data, sample_rate, n_fft=4096, hop_length=1024, window_name='hann'):
    """
    Computes STFT returning frequencies, times, and magnitude in dBFS.
    """
    y = np.asarray(audio_data, dtype=np.float32)
    
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length, win_length=n_fft, window=window_name, center=True)
    mag = np.abs(D)
    
    # Normalize by window sum to get proper amplitude
    win = get_window(window_name, n_fft)
    mag_normalized = mag * (2.0 / np.sum(win))
    
    epsilon = 1e-10
    db = 20 * np.log10(np.clip(mag_normalized, epsilon, None))
    
    freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=n_fft)
    times = librosa.frames_to_time(np.arange(D.shape[1]), sr=sample_rate, hop_length=hop_length, n_fft=n_fft)
    
    return freqs, times, db

def get_window_info(n_fft, sample_rate):
    delta_f = sample_rate / n_fft
    t_frame = n_fft / sample_rate * 1000.0 # ms
    return delta_f, t_frame
