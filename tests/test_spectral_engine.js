/**
 * test_spectral_engine.js - Test suite for SpectralEngine
 */

const assert = require('assert');
const SpectralEngine = require('../js/spectral-engine.js');

console.log('--- RUNNING SPECTRALDIFF ENGINE TESTS ---');

// Test 1: FFT Cooley-Tukey Radix-2
{
  const n = 16;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  // Pure DC signal
  for (let i = 0; i < n; i++) real[i] = 1.0;
  SpectralEngine.computeFFT(real, imag);
  assert.strictEqual(Math.round(real[0]), 16);
  assert.strictEqual(Math.round(real[1]), 0);
  console.log('✓ Radix-2 FFT computation passed.');
}

// Test 2: STFT Computation
{
  const track = SpectralEngine.generateSyntheticTrack('mp3_128k', 48000, 0.5);
  const stftRef = SpectralEngine.computeSTFT(track.refSamples, 48000, 512, 128);
  assert(stftRef.numFrames > 50);
  assert.strictEqual(stftRef.numBins, 256);
  assert(stftRef.meanSpectrum[0] > -80);
  console.log('✓ STFT Processing passed.');
}

// Test 3: Difference Spectrogram
{
  const track = SpectralEngine.generateSyntheticTrack('mp3_128k', 48000, 0.5);
  const stftRef = SpectralEngine.computeSTFT(track.refSamples, 48000, 512, 128);
  const stftTgt = SpectralEngine.computeSTFT(track.tgtSamples, 48000, 512, 128);

  const diff = SpectralEngine.computeDifferenceSpectrogram(stftRef, stftTgt);
  assert.strictEqual(diff.valid, true);
  assert.strictEqual(diff.numBins, 256);
  console.log('✓ Difference Spectrogram passed.');
}

// Test 4: Cutoff Detection & Forensic Audit
{
  const trackMp3 = SpectralEngine.generateSyntheticTrack('mp3_128k', 48000, 0.5);
  const stftMp3 = SpectralEngine.computeSTFT(trackMp3.tgtSamples, 48000, 512, 128);
  const auditMp3 = SpectralEngine.auditAudioIntegrity(stftMp3, 48000);

  assert.strictEqual(auditMp3.verdict, 'LOSSY_MP3_128K');
  assert(auditMp3.cutoff.hasCutoff);
  assert(auditMp3.cutoff.cutoffFreqKhz < 18.0);

  const trackClean = SpectralEngine.generateSyntheticTrack('clean', 48000, 0.5);
  const stftClean = SpectralEngine.computeSTFT(trackClean.refSamples, 48000, 512, 128);
  const auditClean = SpectralEngine.auditAudioIntegrity(stftClean, 48000);
  assert.strictEqual(auditClean.verdict, 'GENUINE_LOSSLESS');

  console.log('✓ Cutoff Detection & Forensic Audit passed.');
}

// Test 5: Cross-correlation Signal Alignment
{
  const n = 4800;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);

  const alignZero = SpectralEngine.alignSignals(a, a, 48000);
  assert.strictEqual(alignZero.lagSamples, 0);
  assert(Math.abs(alignZero.gainDb) < 0.1);
  assert.strictEqual(alignZero.polarity, 1.0);

  console.log('✓ Cross-correlation Alignment passed.');
}

console.log('\nALL 5 SPECTRALDIFF ENGINE TESTS PASSED SUCCESSFULLY!');
