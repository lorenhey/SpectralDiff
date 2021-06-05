import pyqtgraph as pg
from PyQt6.QtWidgets import QWidget, QVBoxLayout
import numpy as np

class InspectorWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.plot_widget = pg.PlotWidget(background='w', title="FFT Inspector")
        self.layout.addWidget(self.plot_widget)
        
        self.plot_widget.setLabel('bottom', 'Frequency', units='Hz', color='k')
        self.plot_widget.setLabel('left', 'Magnitude', units='dB', color='k')
        self.plot_widget.showGrid(x=True, y=True, alpha=0.3)
        self.plot_widget.getAxis('bottom').setPen('k')
        self.plot_widget.getAxis('left').setPen('k')
        self.plot_widget.getAxis('bottom').setTextPen('k')
        self.plot_widget.getAxis('left').setTextPen('k')
        
        self.curve = self.plot_widget.plot(pen=pg.mkPen('b', width=1.5))
        
    def set_data(self, freqs, magnitude_db):
        if len(freqs) > 0 and len(magnitude_db) > 0:
            self.curve.setData(freqs, magnitude_db)
            self.plot_widget.setXRange(0, freqs[-1])
            self.plot_widget.setYRange(-120, 5)
