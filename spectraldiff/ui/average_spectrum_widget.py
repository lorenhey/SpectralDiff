import pyqtgraph as pg
from PyQt6.QtWidgets import QWidget, QVBoxLayout
import numpy as np

class AverageSpectrumWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.plot_widget = pg.PlotWidget(background='w', title="Average & Peak Spectrum (Log Freq)")
        self.layout.addWidget(self.plot_widget)
        
        self.plot_widget.setLabel('bottom', 'Log Frequency', units='Hz', color='k')
        self.plot_widget.setLabel('left', 'Magnitude', units='dB', color='k')
        self.plot_widget.showGrid(x=True, y=True, alpha=0.3)
        # Using manual log scale on X axis by passing log10(x) to setData
        # and formatting the bottom axis tick labels.
        
        self.plot_widget.getAxis('bottom').setPen('k')
        self.plot_widget.getAxis('left').setPen('k')
        self.plot_widget.getAxis('bottom').setTextPen('k')
        self.plot_widget.getAxis('left').setTextPen('k')
        
        self.plot_widget.addLegend()
        
        self.curve_avg_a = self.plot_widget.plot(pen=pg.mkPen('b', width=2), name="Avg A")
        self.curve_peak_a = self.plot_widget.plot(pen=pg.mkPen(color=(0,0,255,100), width=1, style=pg.QtCore.Qt.PenStyle.DashLine), name="Peak A")
        
        self.curve_avg_b = self.plot_widget.plot(pen=pg.mkPen('r', width=2), name="Avg B")
        self.curve_peak_b = self.plot_widget.plot(pen=pg.mkPen(color=(255,0,0,100), width=1, style=pg.QtCore.Qt.PenStyle.DashLine), name="Peak B")
        
        # Format bottom axis to show true frequencies instead of log values
        class LogAxis(pg.AxisItem):
            def tickStrings(self, values, scale, spacing):
                return ["{:.0f}".format(10**x) for x in values]
                
        log_axis = LogAxis(orientation='bottom')
        log_axis.setPen('k')
        log_axis.setTextPen('k')
        self.plot_widget.setAxisItems({'bottom': log_axis})
        
    def set_data(self, freqs, stft_mag_db_a, stft_mag_db_b=None):
        if len(freqs) == 0:
            return
            
        valid_idx = freqs > 0
        freqs_log = np.log10(freqs[valid_idx])
        
        if stft_mag_db_a is not None:
            avg_a = np.mean(stft_mag_db_a, axis=1)[valid_idx]
            peak_a = np.max(stft_mag_db_a, axis=1)[valid_idx]
            self.curve_avg_a.setData(freqs_log, avg_a)
            self.curve_peak_a.setData(freqs_log, peak_a)
            self.curve_avg_a.show()
            self.curve_peak_a.show()
        else:
            self.curve_avg_a.hide()
            self.curve_peak_a.hide()
            
        if stft_mag_db_b is not None:
            avg_b = np.mean(stft_mag_db_b, axis=1)[valid_idx]
            peak_b = np.max(stft_mag_db_b, axis=1)[valid_idx]
            self.curve_avg_b.setData(freqs_log, avg_b)
            self.curve_peak_b.setData(freqs_log, peak_b)
            self.curve_avg_b.show()
            self.curve_peak_b.show()
        else:
            self.curve_avg_b.hide()
            self.curve_peak_b.hide()
            
        self.plot_widget.setYRange(-120, 5)
