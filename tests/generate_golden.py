import numpy as np
import soundfile as sf
import os

def generate_tone(freq, duration, sr=48000, filename="test_tone.wav"):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = 0.5 * np.sin(2 * np.pi * freq * t)
    stereo = np.column_stack((signal, signal))
    sf.write(filename, stereo, sr)

if __name__ == "__main__":
    os.makedirs("tests/data", exist_ok=True)
    generate_tone(1000, 2.0, filename="tests/data/1khz_tone.wav")
    
    t = np.linspace(0, 2.0, int(48000 * 2.0), endpoint=False)
    s1 = 0.25 * np.sin(2 * np.pi * 1000 * t)
    s2 = 0.25 * np.sin(2 * np.pi * 3000 * t)
    stereo = np.column_stack((s1+s2, s1+s2))
    sf.write("tests/data/two_tones.wav", stereo, 48000)
    
    # 15kHz cutoff test (simulate MP3 cutoff)
    noise = np.random.randn(int(48000 * 2.0)) * 0.1
    # Very crude lowpass via FFT
    F = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(len(noise), 1/48000)
    F[freqs > 15000] = 0
    noise_lp = np.fft.irfft(F)
    stereo_lp = np.column_stack((noise_lp, noise_lp))
    sf.write("tests/data/noise_15khz_cutoff.wav", stereo_lp, 48000)
    
    print("Golden files generated.")
