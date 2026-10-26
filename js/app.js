/**
 * app.js - SpectralDiff Interactive Controller & Spectrogram Visualizer v2.0.0
 * Pair programming: Loren (lorenhey) & Antigravity
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var engine = window.SpectralEngine;
  if (!engine) {
    console.error('SpectralEngine not found!');
    return;
  }

  // --- State ---
  var state = {
    activeTab: 'spectrograms',
    activePresetKey: 'mp3_128k',
    sampleRate: 48000,
    track: null,
    stftRef: null,
    stftTgt: null,
    stftDiff: null,
    alignment: null,
    auditRef: null,
    auditTgt: null,
    inspector: {
      activeFrameIdx: 20,
      activeFreqHz: 15600,
      levelRefDb: -25.0,
      levelTgtDb: -120.0,
      levelDiffDb: -95.0
    }
  };

  // --- Navigation Tabs ---
  var tabButtons = document.querySelectorAll('.nav-tab');
  var tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabPanes.forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      var pane = document.getElementById('pane-' + target);
      if (pane) pane.classList.add('active');

      state.activeTab = target;
      redrawAll();
    });
  });

  // --- 1. Scenario Loader & Analysis ---
  var selectPreset = document.getElementById('select-track-preset');

  function loadTrackScenario(presetKey) {
    state.activePresetKey = presetKey;
    state.sampleRate = presetKey === 'fake_hires_upsample' ? 96000 : 48000;

    // Generate tracks
    state.track = engine.generateSyntheticTrack(presetKey, state.sampleRate, 1.0);

    // Compute STFTs
    var fftSize = 512;
    var hopSize = 128;
    state.stftRef = engine.computeSTFT(state.track.refSamples, state.sampleRate, fftSize, hopSize);
    state.stftTgt = engine.computeSTFT(state.track.tgtSamples, state.sampleRate, fftSize, hopSize);

    // Compute Difference Spectrogram (B - A)
    state.stftDiff = engine.computeDifferenceSpectrogram(state.stftRef, state.stftTgt);

    // Alignment
    state.alignment = engine.alignSignals(state.track.refSamples, state.track.tgtSamples, state.sampleRate);

    // Forensic Audits
    state.auditRef = engine.auditAudioIntegrity(state.stftRef, state.sampleRate);
    state.auditTgt = engine.auditAudioIntegrity(state.stftTgt, state.sampleRate);

    updateVerdictUI();
    updateAlignmentUI();
    updateReportUI();
    redrawAll();
  }

  function updateVerdictUI() {
    var audit = state.auditTgt;
    var titleEl = document.getElementById('verdict-title-text');
    var badgeEl = document.getElementById('verdict-badge');
    var descEl = document.getElementById('verdict-desc-text');

    if (audit.verdict === 'LOSSY_MP3_128K') {
      titleEl.textContent = 'MP3 128 kbps Low-Pass Cutoff Detected';
      badgeEl.className = 'status-badge danger';
      badgeEl.textContent = '● LOSSY COMPRESSION';
      descEl.textContent = 'Severe brickwall filter at 16.0 kHz. High-frequency content above 16 kHz has been completely eliminated by psychoacoustic quantization.';
    } else if (audit.verdict === 'LOSSY_MP3_320K') {
      titleEl.textContent = 'MP3 320 kbps Brickwall Filter Detected';
      badgeEl.className = 'status-badge warning';
      badgeEl.textContent = '● HIGH-BITRATE LOSSY';
      descEl.textContent = 'Steep frequency shelf at 19.5 kHz. High frequencies present up to 20 kHz, but brickwall roll-off excludes genuine 22-24 kHz ultrasonic air.';
    } else if (audit.verdict === 'FAKE_UPSAMPLED_HIRES') {
      titleEl.textContent = 'Fake Hi-Res Audio (Upsampled Red Book CD)';
      badgeEl.className = 'status-badge danger';
      badgeEl.textContent = '● FAKE 96 kHz FLAC';
      descEl.textContent = 'File container reports 96 kHz sample rate, but audio energy terminates abruptly at 22.05 kHz (Red Book CD Nyquist). Frequencies between 22 and 48 kHz are empty noise.';
    } else if (state.activePresetKey === 'analog_eq_shelf') {
      titleEl.textContent = 'Analog EQ High-Shelf Boost & Mains Hum';
      badgeEl.className = 'status-badge warning';
      badgeEl.textContent = '● EQ / REMASTER';
      descEl.textContent = '+4 dB high-shelf boost active above 10 kHz with 50 Hz analog ground loop hum induction.';
    } else if (state.activePresetKey === 'clipped_master') {
      titleEl.textContent = 'Digital Clipping & Limiter Splatter';
      badgeEl.className = 'status-badge danger';
      badgeEl.textContent = '● HARMONIC DISTORTION';
      descEl.textContent = 'Heavy waveform flat-topping generating unnatural odd harmonic splatter across upper octave bands.';
    } else {
      titleEl.textContent = 'Genuine Lossless Audio (Full Bandwidth)';
      badgeEl.className = 'status-badge ok';
      badgeEl.textContent = '● 100% BIT-PERFECT';
      descEl.textContent = 'Harmonic spectrum extends smoothly towards Nyquist without artificial brickwall cliffs or lossy codec cutoff.';
    }

    // Metric Tiles
    document.getElementById('val-eff-bw').textContent = (audit.effectiveBandwidthKhz).toFixed(1) + ' kHz';
    document.getElementById('val-cutoff-freq').textContent = audit.cutoff.hasCutoff ? audit.cutoff.cutoffFreqKhz.toFixed(1) + ' kHz' : 'None';
    document.getElementById('val-cutoff-pers').textContent = audit.cutoff.hasCutoff ? Math.round(audit.cutoff.persistence * 100) + '%' : '0%';
    document.getElementById('val-sample-rate').textContent = (state.sampleRate / 1e3) + ' kHz';
  }

  function updateAlignmentUI() {
    var al = state.alignment;
    if (al) {
      document.getElementById('val-align-lag').textContent = al.lagSamples + ' spl (' + al.lagMs.toFixed(2) + ' ms)';
      document.getElementById('val-align-gain').textContent = (al.gainDb >= 0 ? '+' : '') + al.gainDb.toFixed(2) + ' dB';
      document.getElementById('val-align-pol').textContent = al.polarity > 0 ? '+ Normal' : '- Inverted (180°)';
    }
  }

  if (selectPreset) {
    selectPreset.addEventListener('change', function () {
      loadTrackScenario(selectPreset.value);
    });
  }

  // --- 2. Canvas Spectrogram Renderers ---
  var canvasSpecA = document.getElementById('canvas-spec-a');
  var canvasSpecB = document.getElementById('canvas-spec-b');
  var canvasSpecDiff = document.getElementById('canvas-spec-diff');
  var canvasInspectorFft = document.getElementById('canvas-inspector-fft');

  // Colormaps
  function dbToColor(db, dbMin, dbMax) {
    // Clamped 0.0 to 1.0
    var norm = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin)));
    // Viridis/Magma gradient approximation
    var r = 0, g = 0, b = 0;
    if (norm < 0.25) {
      // Black to Dark Purple
      r = Math.floor(norm * 4 * 70);
      g = Math.floor(norm * 4 * 15);
      b = Math.floor(norm * 4 * 140);
    } else if (norm < 0.5) {
      // Purple to Cyan/Teal
      var n2 = (norm - 0.25) * 4;
      r = Math.floor(70 + n2 * (20 - 70));
      g = Math.floor(15 + n2 * (160 - 15));
      b = Math.floor(140 + n2 * (220 - 140));
    } else if (norm < 0.75) {
      // Teal to Amber
      var n3 = (norm - 0.5) * 4;
      r = Math.floor(20 + n3 * (240 - 20));
      g = Math.floor(160 + n3 * (190 - 160));
      b = Math.floor(220 + n3 * (30 - 220));
    } else {
      // Amber to White
      var n4 = (norm - 0.75) * 4;
      r = Math.floor(240 + n4 * (255 - 240));
      g = Math.floor(190 + n4 * (255 - 190));
      b = Math.floor(30 + n4 * (255 - 30));
    }
    return [r, g, b];
  }

  function diffDbToColor(deltaDb) {
    // Diverging bipolar: -24 dB (Cyan/Blue) to 0 dB (Dark Slate) to +24 dB (Red/Orange)
    var clamped = Math.max(-24, Math.min(24, deltaDb));
    if (Math.abs(clamped) < 0.8) {
      return [20, 28, 44]; // Neutral dark
    }
    if (clamped < 0) {
      // Loss / Attenuation (Cyan)
      var normLoss = Math.abs(clamped) / 24.0;
      return [
        Math.floor(20 * (1 - normLoss)),
        Math.floor(28 + normLoss * 180),
        Math.floor(44 + normLoss * 211)
      ];
    } else {
      // Boost / Splatter (Red/Amber)
      var normBoost = clamped / 24.0;
      return [
        Math.floor(20 + normBoost * 228),
        Math.floor(28 + normBoost * 90),
        Math.floor(44 * (1 - normBoost))
      ];
    }
  }

  function renderSpectrogram(canvas, stft, isDiff) {
    if (!canvas || !stft) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.parentElement.clientWidth;
    var h = canvas.height = 220;

    var imgData = ctx.createImageData(w, h);
    var data = imgData.data;

    var numFrames = stft.numFrames;
    var numBins = stft.numBins;

    var padL = 40, padB = 20;
    var plotW = w - padL;
    var plotH = h - padB;

    // Fill background
    for (var p = 0; p < data.length; p += 4) {
      data[p] = 7; data[p + 1] = 10; data[p + 2] = 16; data[p + 3] = 255;
    }

    // Render STFT grid
    for (var x = 0; x < plotW; x++) {
      var frameIdx = Math.floor((x / plotW) * numFrames);
      if (frameIdx >= numFrames) frameIdx = numFrames - 1;

      var frame = isDiff ? stft.diffMatrix[frameIdx] : stft.magDbMatrix[frameIdx];

      for (var y = 0; y < plotH; y++) {
        // High frequency at top (y=0 -> bin = numBins-1), low freq at bottom
        var binIdx = Math.floor(((plotH - 1 - y) / plotH) * numBins);
        if (binIdx >= numBins) binIdx = numBins - 1;

        var val = frame[binIdx];
        var rgb = isDiff ? diffDbToColor(val) : dbToColor(val, -100, -10);

        var pxIdx = ((y * w) + (padL + x)) * 4;
        data[pxIdx] = rgb[0];
        data[pxIdx + 1] = rgb[1];
        data[pxIdx + 2] = rgb[2];
        data[pxIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Axis Labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    var maxFKhz = (stft.binFreqs[numBins - 1] / 1e3).toFixed(0);

    ctx.fillText(maxFKhz + 'k', 4, 14);
    ctx.fillText((maxFKhz / 2).toFixed(0) + 'k', 4, plotH / 2 + 4);
    ctx.fillText('0 Hz', 4, plotH - 2);

    ctx.fillText('0.0s', padL + 4, h - 6);
    ctx.fillText('1.0s', w - 30, h - 6);

    // Crosshair line if hovered
    if (state.inspector.activeFrameIdx >= 0 && state.inspector.activeFrameIdx < numFrames) {
      var crossX = padL + Math.floor((state.inspector.activeFrameIdx / numFrames) * plotW);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(crossX, 0); ctx.lineTo(crossX, plotH);
      ctx.stroke();
    }
  }

  function renderInspectorFft(canvas) {
    if (!canvas || !state.stftRef || !state.stftTgt) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.parentElement.clientWidth;
    var h = canvas.height = 200;

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    var fIdx = Math.min(state.inspector.activeFrameIdx, state.stftRef.numFrames - 1);
    var frameA = state.stftRef.magDbMatrix[fIdx];
    var frameB = state.stftTgt.magDbMatrix[fIdx];
    var numBins = state.stftRef.numBins;
    var freqs = state.stftRef.binFreqs;

    var padL = 40, padR = 20, padT = 20, padB = 25;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    var dbMin = -120, dbMax = 0;

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui';

    for (var db = 0; db >= dbMin; db -= 30) {
      var y = padT + ((dbMax - db) / (dbMax - dbMin)) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(db + ' dB', 5, y + 3);
    }

    // Ref Spectrum (Green/Cyan)
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (var i = 0; i < numBins; i++) {
      var x = padL + (i / (numBins - 1)) * plotW;
      var yA = padT + ((dbMax - frameA[i]) / (dbMax - dbMin)) * plotH;
      if (i === 0) ctx.moveTo(x, yA); else ctx.lineTo(x, yA);
    }
    ctx.stroke();

    // Target Spectrum (Orange/Red)
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (var j = 0; j < numBins; j++) {
      var xB = padL + (j / (numBins - 1)) * plotW;
      var yB = padT + ((dbMax - frameB[j]) / (dbMax - dbMin)) * plotH;
      if (j === 0) ctx.moveTo(xB, yB); else ctx.lineTo(xB, yB);
    }
    ctx.stroke();

    // Frequency labels
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('0 Hz', padL, h - 8);
    ctx.fillText((freqs[Math.floor(numBins / 2)] / 1e3).toFixed(1) + ' kHz', padL + plotW / 2 - 15, h - 8);
    ctx.fillText((freqs[numBins - 1] / 1e3).toFixed(1) + ' kHz', w - padR - 35, h - 8);

    // Legend
    ctx.fillStyle = '#34d399';
    ctx.fillText('— Reference (A)', padL + 10, padT + 12);
    ctx.fillStyle = '#f87171';
    ctx.fillText('— Target (B)', padL + 120, padT + 12);
  }

  function redrawAll() {
    renderSpectrogram(canvasSpecA, state.stftRef, false);
    renderSpectrogram(canvasSpecB, state.stftTgt, false);
    renderSpectrogram(canvasSpecDiff, state.stftDiff, true);
    renderInspectorFft(canvasInspectorFft);
  }

  // --- 3. Interactive Spectrogram Hover Inspector ---
  function setupHoverInspector(canvas) {
    if (!canvas) return;
    canvas.addEventListener('mousemove', function (e) {
      if (!state.stftRef) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;

      var padL = 40, padB = 20;
      var plotW = canvas.width - padL;
      var plotH = canvas.height - padB;

      if (x < padL || y > plotH) return;

      var normX = (x - padL) / plotW;
      var normY = (plotH - y) / plotH; // 0 at bottom, 1 at top

      var fIdx = Math.floor(normX * state.stftRef.numFrames);
      if (fIdx >= state.stftRef.numFrames) fIdx = state.stftRef.numFrames - 1;

      var bIdx = Math.floor(normY * state.stftRef.numBins);
      if (bIdx >= state.stftRef.numBins) bIdx = state.stftRef.numBins - 1;

      state.inspector.activeFrameIdx = fIdx;
      state.inspector.activeFreqHz = state.stftRef.binFreqs[bIdx];
      state.inspector.levelRefDb = state.stftRef.magDbMatrix[fIdx][bIdx];
      state.inspector.levelTgtDb = state.stftTgt.magDbMatrix[fIdx][bIdx];
      state.inspector.levelDiffDb = state.stftDiff.diffMatrix[fIdx][bIdx];

      // Update Inspector UI values
      document.getElementById('insp-freq').textContent = (state.inspector.activeFreqHz / 1e3).toFixed(2) + ' kHz';
      document.getElementById('insp-ref-db').textContent = state.inspector.levelRefDb.toFixed(1) + ' dBFS';
      document.getElementById('insp-tgt-db').textContent = state.inspector.levelTgtDb.toFixed(1) + ' dBFS';
      document.getElementById('insp-diff-db').textContent = (state.inspector.levelDiffDb >= 0 ? '+' : '') + state.inspector.levelDiffDb.toFixed(1) + ' dB';

      redrawAll();
    });
  }

  setupHoverInspector(canvasSpecA);
  setupHoverInspector(canvasSpecB);
  setupHoverInspector(canvasSpecDiff);

  window.addEventListener('resize', redrawAll);

  // --- 4. Report Exporter ---
  var reportArea = document.getElementById('report-text-area');
  var btnCopyReport = document.getElementById('btn-copy-report');
  var btnExportMd = document.getElementById('btn-export-md');
  var btnExportJson = document.getElementById('btn-export-json');

  function generateMarkdownReport() {
    var dateIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
    var audit = state.auditTgt;
    var al = state.alignment;

    var md = [
      '# SpectralDiff - Forensic Audio Investigation Report',
      '*Generated: ' + dateIso + ' UTC via SpectralDiff v2.0.0*',
      '',
      '## 1. Executive Forensic Verdict',
      '- **Verdict:** `' + audit.verdict + '` (Confidence: ' + audit.confidence + ')',
      '- **Effective Bandwidth:** ' + audit.effectiveBandwidthKhz.toFixed(2) + ' kHz',
      '- **Sample Rate:** ' + state.sampleRate + ' Hz (Nyquist: ' + (state.sampleRate / 2e3) + ' kHz)',
      '- **Brickwall Cutoff:** ' + (audit.cutoff.hasCutoff ? audit.cutoff.cutoffFreqKhz.toFixed(2) + ' kHz (Persistence: ' + Math.round(audit.cutoff.persistence * 100) + '%)' : 'None detected'),
      '',
      '### Detailed Findings:',
      audit.findings.map(function (f) { return '- ' + f; }).join('\n'),
      '',
      '## 2. A/B Cross-Correlation Alignment',
      '- **Lag Offset:** ' + al.lagSamples + ' samples (' + al.lagMs.toFixed(3) + ' ms)',
      '- **Gain Difference:** ' + (al.gainDb >= 0 ? '+' : '') + al.gainDb.toFixed(2) + ' dB',
      '- **Signal Polarity:** ' + (al.polarity > 0 ? '+1 (Normal)' : '-1 (Inverted)'),
      '',
      '## 3. Spectral Difference Summary (B - A)',
      '- **STFT Window:** 512 samples Hann, hop 128 samples',
      '- **Mean Spectrum Delta:** ' + (state.stftDiff ? state.stftDiff.meanDiff[Math.floor(state.stftDiff.numBins / 2)].toFixed(1) + ' dB @ midpoint' : 'N/A')
    ];

    return md.join('\n');
  }

  function updateReportUI() {
    if (reportArea) {
      reportArea.value = generateMarkdownReport();
    }
  }

  if (btnCopyReport) {
    btnCopyReport.addEventListener('click', function () {
      updateReportUI();
      navigator.clipboard.writeText(reportArea.value).then(function () {
        var orig = btnCopyReport.textContent;
        btnCopyReport.textContent = '✓ Copied!';
        setTimeout(function () { btnCopyReport.textContent = orig; }, 1800);
      });
    });
  }

  if (btnExportMd) {
    btnExportMd.addEventListener('click', function () {
      updateReportUI();
      var blob = new Blob([reportArea.value], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'spectraldiff-forensic-report.md';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', function () {
      var jsonObj = {
        verdict: state.auditTgt.verdict,
        effectiveBandwidthKhz: state.auditTgt.effectiveBandwidthKhz,
        cutoff: state.auditTgt.cutoff,
        alignment: state.alignment,
        inspector: state.inspector
      };
      var blob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'spectraldiff-audit.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Initial Run
  loadTrackScenario('mp3_128k');
});
