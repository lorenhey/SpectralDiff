/**
 * spectral-engine.js - SpectralDiff Core Diagnostic & DSP Engine v2.0.0
 * Pure JavaScript, offline-capable, high-performance FFT & STFT spectral comparator.
 * Author: Loren (lorenhey)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SpectralEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- 1. FFT Implementation (Cooley-Tukey Radix-2) ---
  function computeFFT(real, imag) {
    var n = real.length;
    if ((n & (n - 1)) !== 0) {
      throw new Error('FFT length must be a power of 2');
    }

    var j = 0;
    for (var i = 0; i < n - 1; i++) {
      if (i < j) {
        var tempR = real[i]; real[i] = real[j]; real[j] = tempR;
        var tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
      }
      var k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (var len = 2; len <= n; len <<= 1) {
      var halfLen = len >> 1;
      var angle = (-2 * Math.PI) / len;
      var wstepR = Math.cos(angle);
      var wstepI = Math.sin(angle);

      for (var p = 0; p < n; p += len) {
        var wr = 1.0;
        var wi = 0.0;
        for (var q = 0; q < halfLen; q++) {
          var uR = real[p + q];
          var uI = imag[p + q];
          var vR = real[p + q + halfLen] * wr - imag[p + q + halfLen] * wi;
          var vI = real[p + q + halfLen] * wi + imag[p + q + halfLen] * wr;

          real[p + q] = uR + vR;
          imag[p + q] = uI + vI;
          real[p + q + halfLen] = uR - vR;
          imag[p + q + halfLen] = uI - vI;

          var nextWr = wr * wstepR - wi * wstepI;
          var nextWi = wr * wstepI + wi * wstepR;
          wr = nextWr;
          wi = nextWi;
        }
      }
    }
  }

  // --- 2. STFT Processor ---
  function computeSTFT(samples, sampleRate, fftSize, hopSize) {
    fftSize = fftSize || 1024;
    hopSize = hopSize || 256;
    sampleRate = sampleRate || 48000;

    var numFrames = Math.max(1, Math.floor((samples.length - fftSize) / hopSize) + 1);
    var numBins = fftSize / 2;
    var binFreqs = new Float32Array(numBins);
    var binWidth = sampleRate / fftSize;

    for (var b = 0; b < numBins; b++) {
      binFreqs[b] = b * binWidth;
    }

    // Hann window
    var window = new Float32Array(fftSize);
    for (var w = 0; w < fftSize; w++) {
      window[w] = 0.5 * (1 - Math.cos((2 * Math.PI * w) / (fftSize - 1)));
    }

    // 2D matrix: frames[frameIdx][binIdx] in dBFS
    var magDbMatrix = [];
    var meanSpectrum = new Float32Array(numBins);

    var realBuf = new Float32Array(fftSize);
    var imagBuf = new Float32Array(fftSize);

    for (var f = 0; f < numFrames; f++) {
      var startIdx = f * hopSize;
      for (var i = 0; i < fftSize; i++) {
        realBuf[i] = (startIdx + i < samples.length ? samples[startIdx + i] : 0) * window[i];
        imagBuf[i] = 0;
      }

      computeFFT(realBuf, imagBuf);

      var frameDbs = new Float32Array(numBins);
      for (var k = 0; k < numBins; k++) {
        var mag = Math.sqrt(realBuf[k] * realBuf[k] + imagBuf[k] * imagBuf[k]) / (fftSize / 2);
        var db = 20 * Math.log10(Math.max(mag, 1e-6)); // Clamped to -120 dBFS
        frameDbs[k] = db;
        meanSpectrum[k] += db;
      }
      magDbMatrix.push(frameDbs);
    }

    for (var m = 0; m < numBins; m++) {
      meanSpectrum[m] /= numFrames;
    }

    return {
      sampleRate: sampleRate,
      fftSize: fftSize,
      hopSize: hopSize,
      numFrames: numFrames,
      numBins: numBins,
      binFreqs: binFreqs,
      meanSpectrum: meanSpectrum,
      magDbMatrix: magDbMatrix
    };
  }

  // --- 3. Difference Spectrogram (A - B) ---
  function computeDifferenceSpectrogram(stftA, stftB) {
    if (!stftA || !stftB) {
      return { valid: false, error: 'Both STFT signals must be provided' };
    }

    var numFrames = Math.min(stftA.numFrames, stftB.numFrames);
    var numBins = Math.min(stftA.numBins, stftB.numBins);
    var diffMatrix = [];
    var meanDiff = new Float32Array(numBins);

    for (var f = 0; f < numFrames; f++) {
      var frameDiff = new Float32Array(numBins);
      var frameA = stftA.magDbMatrix[f];
      var frameB = stftB.magDbMatrix[f];

      for (var b = 0; b < numBins; b++) {
        // Delta dB = Target (B) - Reference (A)
        var delta = frameB[b] - frameA[b];
        frameDiff[b] = delta;
        meanDiff[b] += delta;
      }
      diffMatrix.push(frameDiff);
    }

    for (var m = 0; m < numBins; m++) {
      meanDiff[m] /= numFrames;
    }

    return {
      valid: true,
      numFrames: numFrames,
      numBins: numBins,
      binFreqs: stftA.binFreqs.slice(0, numBins),
      diffMatrix: diffMatrix,
      meanDiff: meanDiff
    };
  }

  // --- 4. Quantitative Forensic Diagnostics ---
  function getEffectiveBandwidth(meanSpectrum, freqs, thresholdDb) {
    thresholdDb = thresholdDb || -85.0;
    for (var i = freqs.length - 1; i >= 0; i--) {
      if (meanSpectrum[i] > thresholdDb) {
        return freqs[i];
      }
    }
    return 0.0;
  }

  function detectSpectralCutoff(stftMagDb, freqs, thresholdDb) {
    thresholdDb = thresholdDb || -85.0;
    var numBins = freqs.length;
    var numFrames = stftMagDb.length;

    // Compute mean spectrum
    var meanSpec = new Float32Array(numBins);
    for (var f = 0; f < numFrames; f++) {
      for (var b = 0; b < numBins; b++) {
        meanSpec[b] += stftMagDb[f][b];
      }
    }
    for (var m = 0; m < numBins; m++) meanSpec[m] /= numFrames;

    var cutoffFreq = null;
    var cutoffIdx = -1;

    for (var i = numBins - 1; i > 0; i--) {
      if (meanSpec[i] > thresholdDb) {
        if (i < numBins - 4) { // Noticeably below Nyquist
          cutoffIdx = i;
          cutoffFreq = freqs[i];
        }
        break;
      }
    }

    if (cutoffFreq !== null && cutoffIdx !== -1) {
      // Calculate persistence: how many frames have silence above cutoff
      var framesWithEnergy = 0;
      for (var j = 0; j < numFrames; j++) {
        var frame = stftMagDb[j];
        var maxAbove = -999;
        for (var k = cutoffIdx + 2; k < numBins; k++) {
          if (frame[k] > maxAbove) maxAbove = frame[k];
        }
        if (maxAbove > thresholdDb + 8) framesWithEnergy++;
      }

      var persistence = 1.0 - (framesWithEnergy / numFrames);
      return {
        hasCutoff: true,
        cutoffFreqHz: cutoffFreq,
        cutoffFreqKhz: cutoffFreq / 1e3,
        persistence: persistence
      };
    }

    return {
      hasCutoff: false,
      cutoffFreqHz: null,
      cutoffFreqKhz: null,
      persistence: 0.0
    };
  }

  function auditAudioIntegrity(stft, sampleRate) {
    var nyquist = sampleRate / 2;
    var effBw = getEffectiveBandwidth(stft.meanSpectrum, stft.binFreqs, -85.0);
    var cutoff = detectSpectralCutoff(stft.magDbMatrix, stft.binFreqs, -85.0);

    var verdict = 'GENUINE_LOSSLESS';
    var confidence = 'HIGH';
    var findings = [];

    // Diagnostic 1: Brickwall Cutoff Heuristics
    if (cutoff.hasCutoff && cutoff.persistence > 0.85) {
      var cfKhz = cutoff.cutoffFreqKhz;
      if (cfKhz >= 14.5 && cfKhz <= 16.8) {
        verdict = 'LOSSY_MP3_128K';
        findings.push('Steep 16 kHz brickwall cutoff detected (persistence ' + Math.round(cutoff.persistence * 100) + '%). Characteristic of MP3 128 kbps psychoacoustic low-pass filter.');
      } else if (cfKhz >= 18.5 && cfKhz <= 19.8) {
        verdict = 'LOSSY_MP3_320K';
        findings.push('Steep 19-20 kHz cutoff detected (persistence ' + Math.round(cutoff.persistence * 100) + '%). Characteristic of MP3 256-320 kbps codec.');
      } else if (cfKhz >= 21.0 && cfKhz <= 22.5 && sampleRate >= 88200) {
        verdict = 'FAKE_UPSAMPLED_HIRES';
        findings.push('Brickwall cutoff at 22.05 kHz detected in high sample rate (' + (sampleRate / 1e3) + ' kHz). File is upsampled from Red Book 44.1 kHz CD audio; contains empty bandwidth above 22 kHz.');
      } else {
        findings.push('High-frequency cutoff detected at ' + cfKhz.toFixed(1) + ' kHz.');
      }
    } else {
      findings.push('Continuous spectral energy extending naturally towards Nyquist (' + (effBw / 1e3).toFixed(1) + ' kHz effective). No brickwall cutoff.');
    }

    return {
      verdict: verdict,
      confidence: confidence,
      effectiveBandwidthHz: effBw,
      effectiveBandwidthKhz: effBw / 1e3,
      cutoff: cutoff,
      findings: findings
    };
  }

  // --- 5. Signal Cross-Correlation & Alignment ---
  function alignSignals(refData, tgtData, sampleRate, maxOffsetSec) {
    sampleRate = sampleRate || 48000;
    maxOffsetSec = maxOffsetSec || 0.5;

    var nCheck = Math.min(refData.length, tgtData.length, Math.floor(maxOffsetSec * sampleRate));
    if (nCheck <= 0) return { lagSamples: 0, lagMs: 0, gainDb: 0, polarity: 1.0 };

    var sumRefSq = 0;
    var sumTgtSq = 0;
    for (var i = 0; i < nCheck; i++) {
      sumRefSq += refData[i] * refData[i];
      sumTgtSq += tgtData[i] * tgtData[i];
    }
    var rmsRef = Math.sqrt(sumRefSq / nCheck);
    var rmsTgt = Math.sqrt(sumTgtSq / nCheck);
    var gainLinear = rmsTgt > 1e-9 ? rmsRef / rmsTgt : 1.0;
    var gainDb = 20 * Math.log10(gainLinear);

    // Discrete correlation over small lag window (-250 to +250 samples)
    var maxLag = Math.min(400, Math.floor(nCheck / 4));
    var bestLag = 0;
    var maxCorr = -Infinity;
    var bestPolarity = 1.0;

    for (var lag = -maxLag; lag <= maxLag; lag++) {
      var corr = 0;
      var count = 0;
      for (var j = 0; j < nCheck; j++) {
        var tgtIdx = j + lag;
        if (tgtIdx >= 0 && tgtIdx < nCheck) {
          corr += refData[j] * tgtData[tgtIdx];
          count++;
        }
      }
      var absCorr = Math.abs(corr);
      if (absCorr > maxCorr) {
        maxCorr = absCorr;
        bestLag = lag;
        bestPolarity = corr >= 0 ? 1.0 : -1.0;
      }
    }

    return {
      lagSamples: bestLag,
      lagMs: (bestLag / sampleRate) * 1e3,
      gainDb: gainDb,
      polarity: bestPolarity
    };
  }

  // --- 6. Audio Signal Generators & Presets ---
  function generateSyntheticTrack(presetKey, sampleRate, durationSec) {
    sampleRate = sampleRate || 48000;
    durationSec = durationSec || 1.2;
    var numSamples = Math.floor(sampleRate * durationSec);

    var ref = new Float32Array(numSamples);
    var tgt = new Float32Array(numSamples);

    // Multi-tone musical chord + pink noise background
    for (var i = 0; i < numSamples; i++) {
      var t = i / sampleRate;

      // Base musical harmonics (fundamental 440 Hz + harmonics up to 20 kHz)
      var base = 0;
      var freqs = [220, 440, 880, 1760, 3520, 7040, 11000, 13500, 15600, 17500, 19500, 21500];
      var amps =  [0.3, 0.25, 0.18, 0.12, 0.08, 0.06,  0.05,  0.04,  0.035, 0.025, 0.02,  0.015];

      for (var k = 0; k < freqs.length; k++) {
        if (freqs[k] < sampleRate / 2) {
          base += amps[k] * Math.sin(2 * Math.PI * freqs[k] * t + (k * 0.7));
        }
      }

      // Air / high-frequency texture (white noise filtered)
      var noise = (Math.sin(i * 123.456) % 1.0) * 0.015;
      var sRef = base + noise;
      ref[i] = sRef;

      // Generate Target (B) based on scenario
      var sTgt = sRef;

      if (presetKey === 'mp3_128k') {
        // Severe brickwall cutoff at 16 kHz: remove all harmonics >= 16 kHz
        var mp3Base = 0;
        for (var m = 0; m < freqs.length; m++) {
          if (freqs[m] < 15800) {
            mp3Base += amps[m] * Math.sin(2 * Math.PI * freqs[m] * t + (m * 0.7));
          }
        }
        sTgt = mp3Base; // Dead silence above 16 kHz
      } else if (presetKey === 'fake_hires_upsample') {
        // Upsampled from 44.1 kHz into 96 kHz: zero content above 22.05 kHz
        var cdBase = 0;
        for (var c = 0; c < freqs.length; c++) {
          if (freqs[c] < 21500) {
            cdBase += amps[c] * Math.sin(2 * Math.PI * freqs[c] * t + (c * 0.7));
          }
        }
        sTgt = cdBase;
      } else if (presetKey === 'analog_eq_shelf') {
        // +4 dB high-shelf boost above 10 kHz + slight 50 Hz hum
        var eqBase = 0;
        for (var e = 0; e < freqs.length; e++) {
          var boost = freqs[e] >= 10000 ? 1.58 : 1.0; // +4 dB
          eqBase += amps[e] * boost * Math.sin(2 * Math.PI * freqs[e] * t + (e * 0.7));
        }
        var hum = 0.02 * Math.sin(2 * Math.PI * 50.0 * t);
        sTgt = eqBase + hum;
      } else if (presetKey === 'clipped_master') {
        // Brickwall limiter clipping: drive into +/- 0.4 hard clip
        var drive = sRef * 2.5;
        if (drive > 0.45) sTgt = 0.45;
        else if (drive < -0.45) sTgt = -0.45;
        else sTgt = drive;
      } else {
        // Identical
        sTgt = sRef;
      }

      tgt[i] = sTgt;
    }

    return {
      presetKey: presetKey,
      sampleRate: sampleRate,
      durationSec: durationSec,
      refSamples: ref,
      tgtSamples: tgt
    };
  }

  return {
    computeFFT: computeFFT,
    computeSTFT: computeSTFT,
    computeDifferenceSpectrogram: computeDifferenceSpectrogram,
    getEffectiveBandwidth: getEffectiveBandwidth,
    detectSpectralCutoff: detectSpectralCutoff,
    auditAudioIntegrity: auditAudioIntegrity,
    alignSignals: alignSignals,
    generateSyntheticTrack: generateSyntheticTrack
  };
});
