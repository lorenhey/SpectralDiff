import pyqtgraph as pg
from PyQt6.QtWidgets import QWidget, QVBoxLayout
import numpy as np

class SpectrogramWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        
        # Use a PlotWidget with white background and nice axes
        self.plot_widget = pg.PlotWidget(background='w')
        self.layout.addWidget(self.plot_widget)
        
        self.img = pg.ImageItem()
        self.plot_widget.addItem(self.img)
        
        # Use magma colormap for perceptually uniform visualization
        colormap = pg.colormap.get('magma')
        self.img.setColorMap(colormap)
        
        self.plot_widget.setLabel('bottom', 'Time', units='s', color='k')
        self.plot_widget.setLabel('left', 'Frequency', units='Hz', color='k')
        self.plot_widget.getAxis('bottom').setPen('k')
        self.plot_widget.getAxis('left').setPen('k')
        self.plot_widget.getAxis('bottom').setTextPen('k')
        self.plot_widget.getAxis('left').setTextPen('k')
        
        # Crosshair setup
        self.vLine = pg.InfiniteLine(angle=90, movable=False, pen=pg.mkPen('cyan', width=1))
        self.hLine = pg.InfiniteLine(angle=0, movable=False, pen=pg.mkPen('cyan', width=1))
        self.plot_widget.addItem(self.vLine, ignoreBounds=True)
        self.plot_widget.addItem(self.hLine, ignoreBounds=True)
        
        self.proxy = pg.SignalProxy(self.plot_widget.scene().sigMouseMoved, rateLimit=60, slot=self.mouseMoved)
        self.mouse_callback = None
        self.times = None
        self.freqs = None
        
    def set_data(self, stft_mag_db, freqs, times):
        self.times = times
        self.freqs = freqs
        data_to_plot = stft_mag_db.T
        
        self.img.setImage(data_to_plot, autoLevels=False)
        self.img.setLevels([-120, 0])
        
        if len(times) > 1 and len(freqs) > 1:
            self.img.setRect(pg.QtCore.QRectF(0, 0, times[-1], freqs[-1]))
            
    def mouseMoved(self, evt):
        pos = evt[0]
        if self.plot_widget.sceneBoundingRect().contains(pos):
            mousePoint = self.plot_widget.plotItem.vb.mapSceneToView(pos)
            self.vLine.setPos(mousePoint.x())
            self.hLine.setPos(mousePoint.y())
            if self.mouse_callback:
                self.mouse_callback(mousePoint.x(), mousePoint.y())

    def set_mouse_callback(self, callback):
        self.mouse_callback = callback
