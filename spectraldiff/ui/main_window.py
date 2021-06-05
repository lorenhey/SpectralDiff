import sys
import os
import numpy as np
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QFileDialog, QSplitter,
                             QTabWidget, QComboBox, QCheckBox, QToolBar)
from PyQt6.QtCore import Qt

from spectraldiff.core.audio import AudioFile
from spectraldiff.core.stft import compute_stft
from spectraldiff.core.compare import align_signals, calculate_difference_spectrogram, calculate_residual
from spectraldiff.core.diagnostics import detect_spectral_cutoff, get_effective_bandwidth
from spectraldiff.ui.spectrogram_widget import SpectrogramWidget
from spectraldiff.ui.inspector_widget import InspectorWidget
from spectraldiff.ui.average_spectrum_widget import AverageSpectrumWidget

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SpectralDiff - Audio Spectral Microscope")
        self.resize(1200, 900)
        
        self.audio_a = None
        self.audio_b = None
        self.db_a = None
        self.db_b = None
        self.freqs = None
        self.times = None
        
        self.init_ui()
        
    def init_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)
        
        # Toolbar
        toolbar = QHBoxLayout()
        self.btn_load_a = QPushButton("Load A")
        self.btn_load_a.clicked.connect(self.load_a)
        toolbar.addWidget(self.btn_load_a)
        
        self.lbl_info_a = QLabel("A: None")
        toolbar.addWidget(self.lbl_info_a)
        
        self.btn_load_b = QPushButton("Load B")
        self.btn_load_b.clicked.connect(self.load_b)
        toolbar.addWidget(self.btn_load_b)
        
        self.lbl_info_b = QLabel("B: None")
        toolbar.addWidget(self.lbl_info_b)
        
        toolbar.addStretch()
        
        toolbar.addWidget(QLabel("FFT Size:"))
        self.combo_fft = QComboBox()
        self.combo_fft.addItems(["1024", "2048", "4096", "8192", "16384", "32768"])
        self.combo_fft.setCurrentText("4096")
        self.combo_fft.currentTextChanged.connect(self.recompute)
        toolbar.addWidget(self.combo_fft)
        
        toolbar.addWidget(QLabel("Window:"))
        self.combo_win = QComboBox()
        self.combo_win.addItems(["hann", "hamming", "blackman", "blackmanharris", "flattop"])
        self.combo_win.currentTextChanged.connect(self.recompute)
        toolbar.addWidget(self.combo_win)
        
        layout.addLayout(toolbar)
        
        # Splitter
        self.splitter = QSplitter(Qt.Orientation.Vertical)
        layout.addWidget(self.splitter)
        
        # Top: Spectrograms Tab Widget
        self.spec_tabs = QTabWidget()
        self.splitter.addWidget(self.spec_tabs)
        
        self.spec_widget_a = SpectrogramWidget()
        self.spec_tabs.addTab(self.spec_widget_a, "Spectrogram A")
        self.spec_widget_a.set_mouse_callback(self.on_mouse_moved_a)
        
        self.spec_widget_b = SpectrogramWidget()
        self.spec_tabs.addTab(self.spec_widget_b, "Spectrogram B")
        self.spec_widget_b.set_mouse_callback(self.on_mouse_moved_b)
        
        self.spec_widget_diff = SpectrogramWidget()
        self.spec_tabs.addTab(self.spec_widget_diff, "Difference (A-B)")
        
        self.spec_widget_res = SpectrogramWidget()
        self.spec_tabs.addTab(self.spec_widget_res, "Residual (Null Test)")
        
        # Bottom: Inspector & Average
        self.bottom_tabs = QTabWidget()
        self.splitter.addWidget(self.bottom_tabs)
        
        self.inspector = InspectorWidget()
        self.bottom_tabs.addTab(self.inspector, "FFT Inspector")
        
        self.average_view = AverageSpectrumWidget()
        self.bottom_tabs.addTab(self.average_view, "Average Spectrum")
        
        # Info bar
        self.lbl_cursor = QLabel("Cursor: 0.00 s | 0.0 Hz")
        layout.addWidget(self.lbl_cursor)
        
        self.lbl_diagnostics = QLabel("Ready")
        layout.addWidget(self.lbl_diagnostics)
        
        self.splitter.setSizes([600, 300])

    def load_a(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "Open Track A", "", "Audio Files (*.wav *.flac *.mp3 *.aac)")
        if file_path:
            self.audio_a = AudioFile(file_path)
            self.lbl_info_a.setText(f"A: {self.audio_a.filename} | {self.audio_a.sample_rate}Hz")
            self.recompute()
            
    def load_b(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "Open Track B", "", "Audio Files (*.wav *.flac *.mp3 *.aac)")
        if file_path:
            self.audio_b = AudioFile(file_path)
            self.lbl_info_b.setText(f"B: {self.audio_b.filename} | {self.audio_b.sample_rate}Hz")
            self.recompute()
            
    def recompute(self):
        n_fft = int(self.combo_fft.currentText())
        hop_length = n_fft // 4
        window = self.combo_win.currentText()
        
        diag_a = ""
        diag_b = ""
        
        if self.audio_a:
            mono_a = self.audio_a.get_mid()
            self.freqs, self.times, self.db_a = compute_stft(mono_a, self.audio_a.sample_rate, n_fft, hop_length, window)
            self.spec_widget_a.set_data(self.db_a, self.freqs, self.times)
            
            cutoff_freq, pers, _ = detect_spectral_cutoff(self.db_a, self.freqs)
            bw = get_effective_bandwidth(np.mean(self.db_a, axis=1), self.freqs)
            diag_a = f"[A] BW: {bw:.0f}Hz"
            if cutoff_freq: diag_a += f" | Cutoff: {cutoff_freq:.0f}Hz"
            
        if self.audio_b:
            mono_b = self.audio_b.get_mid()
            
            # Align if we have A
            if self.audio_a and self.audio_a.sample_rate == self.audio_b.sample_rate:
                offset, gain_db, pol = align_signals(mono_a, mono_b, self.audio_a.sample_rate)
                # Apply alignment to B
                # If offset < 0, B is delayed, so we shift B left (drop first -offset samples)
                # If offset > 0, B is ahead, so we shift B right (pad with offset zeros)
                if offset < 0:
                    aligned_b = np.pad(mono_b[-offset:], (0, -offset))
                elif offset > 0:
                    aligned_b = np.pad(mono_b, (offset, 0))[:len(mono_b)]
                else:
                    aligned_b = mono_b
                
                # Apply polarity and gain
                gain_lin = 10**(gain_db/20.0)
                aligned_b = aligned_b * pol / gain_lin
                
                _, _, self.db_b = compute_stft(aligned_b, self.audio_a.sample_rate, n_fft, hop_length, window)
                self.spec_widget_b.set_data(self.db_b, self.freqs, self.times)
                
                # Diff
                delta_db = self.db_a - self.db_b
                self.spec_widget_diff.set_data(delta_db, self.freqs, self.times)
                
                # Residual
                # Make sure arrays match in length before subtracting
                min_len = min(len(mono_a), len(aligned_b))
                res, rms_db = calculate_residual(mono_a[:min_len], aligned_b[:min_len])
                _, _, db_res = compute_stft(res, self.audio_a.sample_rate, n_fft, hop_length, window)
                self.spec_widget_res.set_data(db_res, self.freqs, self.times)
                diag_b += f" | Residual RMS: {rms_db:.1f}dB"
                
                
            else:
                freqs_b, times_b, self.db_b = compute_stft(mono_b, self.audio_b.sample_rate, n_fft, hop_length, window)
                self.spec_widget_b.set_data(self.db_b, freqs_b, times_b)
                
            cutoff_freq_b, pers_b, _ = detect_spectral_cutoff(self.db_b, self.freqs if self.audio_a else freqs_b)
            bw_b = get_effective_bandwidth(np.mean(self.db_b, axis=1), self.freqs if self.audio_a else freqs_b)
            diag_b = f"[B] BW: {bw_b:.0f}Hz"
            if cutoff_freq_b: diag_b += f" | Cutoff: {cutoff_freq_b:.0f}Hz"
            
        self.lbl_diagnostics.setText(f"{diag_a}   {diag_b}")
        self.average_view.set_data(self.freqs, self.db_a, self.db_b)
        
    def on_mouse_moved_a(self, t, f):
        if self.times is not None and self.freqs is not None and self.db_a is not None:
            self.lbl_cursor.setText(f"Cursor A: {t:.3f} s | {f:.1f} Hz")
            # Find closest time frame
            idx = np.searchsorted(self.times, t)
            if idx < len(self.times):
                frame_mag = self.db_a[:, idx]
                self.inspector.set_data(self.freqs, frame_mag)

    def on_mouse_moved_b(self, t, f):
        if self.times is not None and self.freqs is not None and self.db_b is not None:
            self.lbl_cursor.setText(f"Cursor B: {t:.3f} s | {f:.1f} Hz")
            idx = np.searchsorted(self.times, t)
            if idx < len(self.times):
                frame_mag = self.db_b[:, idx]
                self.inspector.set_data(self.freqs, frame_mag)
