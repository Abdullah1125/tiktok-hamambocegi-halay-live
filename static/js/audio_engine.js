// 100-Track Non-Stop YouTube Halay Broadcast Audio Engine
// + iOS Safari Silent-Switch Override ("playback" session) + Real FFT Bass Analyser
// + IndexedDB Custom MP3 + Davul-Zurna Fallback Synth + Soundboard SFX + Turkish TTS

const MAKAM_PRESETS = {
  halay: {
    baseFreq: 392.0,
    baseBpm: 118,
    groups: [2, 2],
    leadWave: "sawtooth",
    filterFreq: 1480,
    filterQ: 3.2,
    melody: [0, 3, 4, 7, 7, 4, 3, 4, 7, 8, 7, 4, 3, 4, 3, 0, 0, 4, 7, 10, 8, 7, 4, 3, 4, 7, 4, 3, 0, -2, 0, 0],
  },
  karadeniz: {
    baseFreq: 440.0,
    baseBpm: 142,
    groups: [2, 2, 3],
    leadWave: "sawtooth",
    filterFreq: 2650,
    filterQ: 2.1,
    melody: [0, 2, 3, 5, 7, 5, 3, 2, 3, 5, 3, 2, 0, -2, 0, 2, 5, 7, 8, 7, 5, 3, 2, 3, 2, 0, -2, 0],
  },
  kina: {
    baseFreq: 329.63,
    baseBpm: 106,
    groups: [2, 2, 2, 3],
    leadWave: "triangle",
    filterFreq: 1350,
    filterQ: 2.6,
    melody: [0, 1, 4, 5, 7, 8, 7, 5, 4, 5, 4, 1, 0, 1, 4, 5, 4, 1, 0],
  },
  erikdali: {
    baseFreq: 440.0,
    baseBpm: 132,
    groups: [2, 2, 2, 2],
    leadWave: "square",
    filterFreq: 1950,
    filterQ: 2.4,
    melody: [7, 7, 8, 7, 5, 4, 5, 7, 4, 4, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 0, 0, 0],
  },
};

const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");

export class HalayAudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.fftData = new Uint8Array(64);
    this._mediaNodeBound = false;

    // Default ON: Continuous 100-Halay Broadcast Mode!
    this.desiredPlaying = true;
    this.isPlaying = false;
    this.needsGestureUnlock = false;
    this.isLoadingTrack = false;
    this.volume = 0.9;

    this.sourceMode = "youtube"; // "youtube" | "custom" | "synth"
    this.currentTrack = null;
    this.onTrackEnded = null;
    this.onStateChange = null;

    this.presetKey = "halay";
    this.bpm = 122;
    this.targetBpm = 122;
    this.beatEnergy = 0;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.timerId = null;

    this.customAudio = null;
    this.ttsEnabled = true;
    this._speakQueue = [];
    this._speaking = false;

    this._configureAudioSession();
    this.ytAudio = this._createPrimaryAudioElement();
    this._bindGlobalUnlockListeners();
    this._restoreSavedMp3();
  }

  _configureAudioSession() {
    if (this._audioSessionConfigured) return;
    // On iOS ReplayKit (TikTok Mobil Oyun Broadcast), forcing "playback" + AudioContext can hijack AVAudioSession.
    // Use "auto" on iOS so ReplayKit RPSampleBufferTypeAudioApp captures Safari media cleanly alongside mic!
    if ("audioSession" in navigator && navigator.audioSession) {
      try {
        navigator.audioSession.type = IS_IOS ? "auto" : "playback";
        this._audioSessionConfigured = true;
      } catch (err) {
        console.debug("[AudioEngine] audioSession config skipped:", err);
      }
    }
  }

  _createPrimaryAudioElement() {
    const el = new Audio();
    el.preload = "auto";
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    // CRITICAL iOS ReplayKit Fix: Do NOT set crossOrigin="anonymous" on iOS!
    // Setting crossOrigin on iOS routes <audio> through WebKit's isolated CORS pipeline which plays on speaker
    // but is muted in ReplayKit (TikTok LIVE). Native AVPlayer (no crossOrigin) goes straight to TikTok LIVE!
    if (!IS_IOS) {
      el.crossOrigin = "anonymous";
    }
    el.volume = this.volume;

    el.addEventListener("playing", () => {
      this.isLoadingTrack = false;
      this.isPlaying = true;
      this.needsGestureUnlock = false;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      this._notifyState();
    });

    el.addEventListener("waiting", () => {
      this.isLoadingTrack = true;
      this._notifyState();
    });

    el.addEventListener("pause", () => {
      if (!this.desiredPlaying) {
        this.isPlaying = false;
        this._notifyState();
      }
    });

    el.addEventListener("ended", () => {
      if (this.sourceMode === "youtube" && this.desiredPlaying) {
        this.onTrackEnded?.("ended");
      }
    });

    el.addEventListener("error", () => {
      console.warn("[AudioEngine] Track stream failed, skipping to next Halay:", this.currentTrack?.id);
      this.isLoadingTrack = false;
      if (this.desiredPlaying) {
        this._startFallbackSynthBriefly();
        setTimeout(() => this.onTrackEnded?.("error"), 1200);
      }
    });

    return el;
  }

  _bindGlobalUnlockListeners() {
    const unlockHandler = (ev) => {
      const tgt = ev?.target;
      if (tgt && tgt.closest?.("#control-drawer")) {
        const tag = tgt.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "OPTION" || tag === "LABEL") {
          return;
        }
      }
      if (this.isPlaying && !this.needsGestureUnlock) return;
      this._configureAudioSession();
      if (!IS_IOS || this.sourceMode === "synth") {
        this.ensureContext();
      }
      if (!IS_IOS && this.ctx && this.ctx.state === "running") {
        this._attachDesktopAnalyser();
      }
      if (this.desiredPlaying && !this.isPlaying) {
        this._attemptActivePlay();
      }
    };
    // iOS Safari strictly requires click / touchend / keydown (NOT pointerdown!)
    window.addEventListener("click", unlockHandler, { passive: true });
    window.addEventListener("touchend", unlockHandler, { passive: true });
    window.addEventListener("keydown", unlockHandler, { passive: true });
  }

  _notifyState() {
    this.onStateChange?.({
      isPlaying: this.isPlaying,
      desiredPlaying: this.desiredPlaying,
      needsUnlock: this.needsGestureUnlock,
      isLoading: this.isLoadingTrack,
      sourceMode: this.sourceMode,
      track: this.currentTrack,
      volume: this.volume,
    });
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number(val)));
    this.ytAudio.volume = this.volume;
    if (this.customAudio) this.customAudio.volume = this.volume;
    this._notifyState();
  }

  async playYouTubeTrack(trackObj, autoPlay = true) {
    if (!trackObj || !trackObj.stream_url) return;
    const sameTrack = this.currentTrack && this.currentTrack.id === trackObj.id;
    this.currentTrack = trackObj;
    if (this.sourceMode !== "custom") {
      this.sourceMode = "youtube";
    }
    if (autoPlay) this.desiredPlaying = true;

    const catBpm = {
      karadeniz_horon: 144,
      ankara_oyun: 132,
      tiktok_remix: 130,
      dugun_semmame: 124,
      dogu_govend: 118,
      agir_grani: 108,
    };
    this.targetBpm = catBpm[trackObj.category] || 122;

    if (!sameTrack || !this.ytAudio.src) {
      this.isLoadingTrack = true;
      this.ytAudio.src = trackObj.stream_url;
      this.ytAudio.load();
    }
    this._notifyState();

    if (this.desiredPlaying && this.sourceMode === "youtube") {
      await this._attemptActivePlay();
    }
  }

  async _attemptActivePlay() {
    if (this.sourceMode === "custom" && this.customAudio) {
      this.ytAudio.pause();
      try {
        await this.customAudio.play();
        this.isPlaying = true;
        this.needsGestureUnlock = false;
      } catch {
        this.isPlaying = false;
        this.needsGestureUnlock = true;
      }
      this._notifyState();
      return;
    }

    if (this.sourceMode === "youtube" && this.ytAudio.src) {
      if (!IS_IOS && this.ctx && this.ctx.state === "running") {
        this._attachDesktopAnalyser();
      }
      try {
        await this.ytAudio.play();
        this.isPlaying = true;
        this.needsGestureUnlock = false;
        this.isLoadingTrack = false;
      } catch (err) {
        if (err && err.name === "NotAllowedError") {
          this.isPlaying = false;
          this.needsGestureUnlock = true;
          this.isLoadingTrack = false;
        } else {
          console.warn("[AudioEngine] Playback warning:", err?.message || err);
        }
      }
      this._notifyState();
      return;
    }

    // Synth fallback if catalog hasn't arrived yet
    this.ensureContext();
    if (this.ctx && this.ctx.state === "running") {
      this.isPlaying = true;
      this.needsGestureUnlock = false;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.scheduler();
    } else {
      this.needsGestureUnlock = true;
    }
    this._notifyState();
  }

  _attachDesktopAnalyser() {
    if (this._mediaNodeBound || IS_IOS) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const src = this.ctx.createMediaElementSource(this.ytAudio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.76;
      src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this._mediaNodeBound = true;
    } catch (err) {
      console.debug("[AudioEngine] Analyser attach skipped:", err);
    }
  }

  _startFallbackSynthBriefly() {
    try {
      this.ensureContext();
      if (this.ctx && this.ctx.state === "running") {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduler(true);
      }
    } catch {}
  }

  async unlockAndPlayNow() {
    this._configureAudioSession();
    if (!IS_IOS || this.sourceMode === "synth") {
      this.ensureContext();
    }
    this.desiredPlaying = true;
    await this._attemptActivePlay();
    return this.isPlaying;
  }

  toggle() {
    this._configureAudioSession();
    if (!IS_IOS || this.sourceMode === "synth") {
      this.ensureContext();
    }
    if (this.isPlaying || (this.desiredPlaying && !this.needsGestureUnlock && !this.ytAudio.paused)) {
      this.desiredPlaying = false;
      this.isPlaying = false;
      this.needsGestureUnlock = false;
      this.ytAudio.pause();
      if (this.customAudio) this.customAudio.pause();
      if (this.timerId) clearTimeout(this.timerId);
      this._notifyState();
      return false;
    }
    this.desiredPlaying = true;
    this._attemptActivePlay();
    return true;
  }

  getProgress() {
    const el = this.sourceMode === "custom" && this.customAudio ? this.customAudio : this.ytAudio;
    const cur = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : (this.currentTrack?.duration || 0);
    return { current: cur, duration: dur };
  }

  getSpectrumBars(barCount = 4) {
    if (!this.isPlaying) return new Array(barCount).fill(0.14);
    if (this.analyser && !this.ytAudio.paused) {
      this.analyser.getByteFrequencyData(this.fftData);
      const out = [];
      for (let i = 0; i < barCount; i++) {
        const bin = Math.min(this.fftData.length - 1, 1 + i * 4);
        out.push(Math.max(0.18, this.fftData[bin] / 255));
      }
      return out;
    }
    const t = performance.now() * 0.001;
    const beat = (t * this.bpm) / 60;
    return Array.from({ length: barCount }, (_, i) =>
      Math.max(0.2, Math.min(1, 0.52 + 0.44 * Math.sin(beat * Math.PI * 2 + i * 1.35)))
    );
  }

  _openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("halay-studio-audio", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("tracks", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _restoreSavedMp3() {
    try {
      const db = await this._openDb();
      const tx = db.transaction("tracks", "readonly").objectStore("tracks").get("custom");
      tx.onsuccess = () => {
        if (tx.result?.blob) this._bindBlobAudio(tx.result.blob, false);
      };
    } catch (err) {
      console.debug("[AudioEngine] IndexedDB restore skipped:", err);
    }
  }

  _bindBlobAudio(blob, autoPlay = true) {
    if (this.customAudio) this.customAudio.pause();
    const url = URL.createObjectURL(blob);
    this.customAudio = new Audio(url);
    this.customAudio.loop = true;
    this.customAudio.preservesPitch = true;
    this.customAudio.volume = this.volume;
    this.sourceMode = "custom";
    this.ytAudio.pause();
    if (autoPlay) {
      this.desiredPlaying = true;
      this._attemptActivePlay();
    }
    this._notifyState();
  }

  async loadCustomFile(file) {
    if (!file) return;
    this._bindBlobAudio(file, true);
    try {
      const db = await this._openDb();
      db.transaction("tracks", "readwrite").objectStore("tracks").put({ id: "custom", blob: file, ts: Date.now() });
    } catch (err) {
      console.warn("[AudioEngine] Custom MP3 cache save failed:", err);
    }
  }

  async clearCustomFile() {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio = null;
    }
    this.sourceMode = "youtube";
    try {
      const db = await this._openDb();
      db.transaction("tracks", "readwrite").objectStore("tracks").delete("custom");
    } catch (err) {
      console.debug("[AudioEngine] Custom MP3 clear skipped:", err);
    }
    if (this.desiredPlaying && this.currentTrack) {
      await this.playYouTubeTrack(this.currentTrack, true);
    }
  }

  setPreset(key) {
    if (!MAKAM_PRESETS[key]) return;
    this.presetKey = key;
    this.targetBpm = MAKAM_PRESETS[key].baseBpm;
    this.stepIndex = 0;
  }

  ensureContext() {
    // On iOS, never open WebAudio AudioContext while playing HTML5 <audio> (YouTube/Custom MP3),
    // because WebKit's AudioUnit session overrides ReplayKit's RPSampleBufferTypeAudioApp capture!
    if (IS_IOS && (this.sourceMode === "youtube" || this.sourceMode === "custom")) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) this.ctx = new AudioCtx();
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setTargetBpm(bpm) {
    this.targetBpm = Math.max(98, Math.min(192, bpm));
  }

  boostTempo(delta = 6) {
    this.setTargetBpm(this.targetBpm + delta);
  }

  update(dt) {
    const base = this.currentTrack ? 122 : (MAKAM_PRESETS[this.presetKey]?.baseBpm || 118);
    this.targetBpm += (base - this.targetBpm) * Math.min(1, dt * 0.22);
    this.bpm += (this.targetBpm - this.bpm) * Math.min(1, dt * 3.5);

    if (this.analyser && this.isPlaying && !this.ytAudio.paused) {
      this.analyser.getByteFrequencyData(this.fftData);
      const kickAvg = (this.fftData[1] + this.fftData[2] + this.fftData[3] + this.fftData[4]) / (4 * 255);
      this.beatEnergy += (kickAvg - this.beatEnergy) * Math.min(1, dt * 14);
    } else if (this.isPlaying) {
      const pulse = 0.5 + 0.5 * Math.sin((performance.now() * 0.001 * this.bpm * Math.PI * 2) / 60);
      this.beatEnergy += (pulse * 0.65 - this.beatEnergy) * Math.min(1, dt * 10);
    } else {
      this.beatEnergy *= 0.9;
    }

    if (this.customAudio && !this.customAudio.paused) {
      this.customAudio.playbackRate = Math.max(0.88, Math.min(1.45, this.bpm / base));
    }
  }

  scheduler(forceBrief = false) {
    if (!this.desiredPlaying) return;
    if (!forceBrief && (this.sourceMode === "custom" || (this.sourceMode === "youtube" && !this.ytAudio.paused))) return;
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playFolkStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += 60.0 / this.bpm / 4.0;
      this.stepIndex++;
    }
    this.timerId = setTimeout(() => this.scheduler(forceBrief), 28);
  }

  playFolkStep(step, time) {
    const p = MAKAM_PRESETS[this.presetKey] || MAKAM_PRESETS.halay;
    const barLen = p.groups.reduce((a, b) => a + b, 0) * 2;
    const barStep = step % barLen;
    let pulseCursor = 0;
    for (let gi = 0; gi < p.groups.length; gi++) {
      if (barStep === pulseCursor) this.playDavulGum(time, gi === 0 ? 0.5 : 0.35);
      else if (barStep === pulseCursor + p.groups[gi] - 1) this.playDavulTak(time, 0.18, 2500);
      pulseCursor += p.groups[gi] * 2;
    }
    if (step % 2 === 0) {
      const semi = p.melody[Math.floor(step / 2) % p.melody.length];
      const freq = p.baseFreq * Math.pow(2, semi / 12);
      const dur = (60.0 / this.bpm / 2.0) * 0.9;
      this.playLeadNote(time, freq, dur, p);
    }
  }

  playDavulGum(time, gainVal) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(122, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.17);
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  playDavulTak(time, gainVal, freq = 2400) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.045);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;
    noise.connect(filter).connect(gain).connect(this.ctx.destination);
    noise.start(time);
  }

  playLeadNote(time, freq, dur, p) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = p.leadWave;
    osc.frequency.setValueAtTime(freq * 1.02, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.028);
    filter.type = "bandpass";
    filter.frequency.value = p.filterFreq;
    filter.Q.value = p.filterQ;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.008, time + dur);
    osc.connect(filter).connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  playCoinChime() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1046.5, 1318.5, 1568.0].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.14, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      o.connect(g).connect(this.ctx.destination);
      o.start(now + idx * 0.06);
      o.stop(now + idx * 0.06 + 0.26);
    });
  }

  playClapBurst(count = 10) {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) {
        this.playDavulTak(now + i * 0.18 + Math.random() * 0.05, 0.16 + Math.random() * 0.12, 1900 + Math.random() * 900);
      }
    }
  }

  playWhistleZilgit() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1750, now);
    osc.frequency.linearRampToValueAtTime(2350, now + 0.65);
    lfo.frequency.value = 18;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(gain).connect(this.ctx.destination);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.74);
    osc.stop(now + 0.74);
  }

  playWinFanfare() {
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.24);
      o.connect(g).connect(this.ctx.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.25);
    });
  }

  speak(text) {
    // Skip Web Speech API on iOS so AVSpeechSynthesizer never hijacks ReplayKit's broadcast audio stream
    if (IS_IOS || !this.ttsEnabled || !("speechSynthesis" in window) || this._speakQueue.length > 3) return;
    this._speakQueue.push(text);
    this._pumpSpeech();
  }

  _pumpSpeech() {
    if (this._speaking || !this._speakQueue.length) return;
    const u = new SpeechSynthesisUtterance(this._speakQueue.shift());
    u.lang = "tr-TR";
    u.rate = 1.08;
    u.volume = 0.92;
    const trVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("tr"));
    if (trVoice) u.voice = trVoice;
    this._speaking = true;
    u.onend = u.onerror = () => {
      this._speaking = false;
      this._pumpSpeech();
    };
    speechSynthesis.speak(u);
  }
}
