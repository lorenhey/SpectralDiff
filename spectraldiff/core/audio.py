import soundfile as sf
import numpy as np
import os
import hashlib

class AudioFile:
    def __init__(self, filepath):
        self.filepath = filepath
        self.filename = os.path.basename(filepath)
        self.filesize = os.path.getsize(filepath)
        
        info = sf.info(filepath)
        self.sample_rate = info.samplerate
        self.channels = info.channels
        self.frames = info.frames
        self.duration = info.duration
        self.format = info.format
        self.subtype = info.subtype
        
        # Load float32 audio data. 
        # (frames, channels)
        self.data, _ = sf.read(filepath, dtype='float32', always_2d=True)
        
        self.sha256 = self._compute_sha256(filepath)
        
    def _compute_sha256(self, filepath):
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def get_channel_data(self, channel_index):
        if channel_index < self.channels:
            return self.data[:, channel_index]
        return None

    def get_mid(self):
        if self.channels >= 2:
            return (self.data[:, 0] + self.data[:, 1]) / 2.0
        return self.data[:, 0]

    def get_side(self):
        if self.channels >= 2:
            return (self.data[:, 0] - self.data[:, 1]) / 2.0
        return np.zeros(self.frames, dtype='float32')
