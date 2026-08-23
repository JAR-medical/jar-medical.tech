// Every sound in Medicraft is synthesised in the browser.
//
// The game ships as a single folder that also gets packed into an EXE, so an
// `assets/audio` directory of WAV/OGG files would have to be carried through
// PyInstaller, the static publish step, and the Docker image. Web Audio can
// make all of it — pads, bells, wind, fire, footsteps, break crunches — from
// oscillators and one shared noise buffer, which costs a few kilobytes of code
// and nothing on disk.
//
// The one rule that shapes this file: **the microphone is the point of the
// game**. Whenever speech is being recorded the music and ambience are ramped
// to silence, because anything the speakers play is something the recogniser
// has to hear past. `duck("recording", true)` is not a mix decision, it is
// dataset hygiene.
//
// Import-safe under node: nothing here touches `window` or `AudioContext`
// until `unlock()` is called from a real user gesture.

const MUSIC_BASE = 0.085;
const AMBIENCE_BASE = 0.1;
const SFX_BASE = 0.55;
const MUSIC_REVERB_SEND = 0.35;
const STORAGE_KEY = "medicraft.audio";

const SCHEDULE_INTERVAL_MS = 180;
const SCHEDULE_LOOKAHEAD = 0.7;

// Semitone offsets from the mood root. Pentatonic sets never produce a bad
// interval, which matters when the melody note is picked at random.
const SCALES = {
  majorPentatonic: [0, 2, 4, 7, 9, 12, 14, 16],
  minorPentatonic: [0, 3, 5, 7, 10, 12, 15, 17],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  lydianSparse: [0, 4, 7, 11, 12, 16, 19],
};

// One entry per level id, plus the menu bed. `density` is the chance a beat
// carries a note at all — low numbers are what makes the track background
// music instead of a melody the player starts listening to.
const MOODS = {
  menu: {
    root: 55,
    scale: "majorPentatonic",
    beat: 1.5,
    density: 0.3,
    padType: "sine",
    bellType: "triangle",
    bellGain: 0.5,
    padGain: 0.55,
    detune: 6,
    cutoff: 900,
  },
  tutorial_clinic: {
    root: 58,
    scale: "majorPentatonic",
    beat: 1.6,
    density: 0.26,
    padType: "sine",
    bellType: "triangle",
    bellGain: 0.45,
    padGain: 0.5,
    detune: 5,
    cutoff: 1000,
  },
  street_collapse: {
    root: 53,
    scale: "minorPentatonic",
    beat: 1.35,
    density: 0.3,
    padType: "sine",
    bellType: "triangle",
    bellGain: 0.42,
    padGain: 0.62,
    detune: 8,
    cutoff: 720,
  },
  highway_pileup: {
    root: 51,
    scale: "dorian",
    beat: 1.5,
    density: 0.22,
    padType: "sine",
    bellType: "sine",
    bellGain: 0.4,
    padGain: 0.7,
    detune: 11,
    cutoff: 560,
  },
  industrial_fire: {
    root: 49,
    scale: "minorPentatonic",
    beat: 1.15,
    density: 0.34,
    padType: "sawtooth",
    bellType: "triangle",
    bellGain: 0.38,
    padGain: 0.4,
    detune: 9,
    cutoff: 480,
  },
  alpine_avalanche: {
    root: 60,
    scale: "lydianSparse",
    beat: 1.8,
    density: 0.24,
    padType: "sine",
    bellType: "sine",
    bellGain: 0.55,
    padGain: 0.45,
    detune: 4,
    cutoff: 1400,
  },
};

// Ambience beds are level-scoped and deliberately thin: a wind band, a traffic
// rumble, a fire crackle. Together with the music they still sit under the
// dialogue level of a spoken report.
const AMBIENCES = {
  tutorial_clinic: { wind: { cutoff: 380, q: 0.7, gain: 0.28, sweep: 0.05 } },
  street_collapse: { wind: { cutoff: 300, q: 0.8, gain: 0.34, sweep: 0.06 }, rumble: { freq: 44, gain: 0.16 } },
  highway_pileup: { wind: { cutoff: 260, q: 0.9, gain: 0.4, sweep: 0.04 }, rumble: { freq: 38, gain: 0.24 } },
  industrial_fire: { wind: { cutoff: 520, q: 0.6, gain: 0.3, sweep: 0.08 }, crackle: { rate: 7, gain: 0.5 }, rumble: { freq: 41, gain: 0.18 } },
  alpine_avalanche: { wind: { cutoff: 700, q: 1.3, gain: 0.5, sweep: 0.12 } },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function readStoredSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    return null;
  }
}

function writeStoredSettings(settings) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    /* private mode, or no storage at all */
  }
}

export class GameAudio {
  constructor() {
    const stored = readStoredSettings();
    this.enabled = stored?.enabled !== false;
    this.musicVolume = Number.isFinite(stored?.music) ? clamp01(stored.music) : 0.7;
    this.sfxVolume = Number.isFinite(stored?.sfx) ? clamp01(stored.sfx) : 0.85;

    this.ctx = null;
    this.ready = false;
    this._ducks = new Set();
    this._mood = null;
    this._scheduler = null;
    this._nextBeat = 0;
    this._beatIndex = 0;
    this._ambience = null;
    this._noiseBuffer = null;
    this._stepPhase = 0;
    this._voiceLock = false;
  }

  // Browsers only allow an AudioContext to start inside a gesture. Every entry
  // point that a click can reach calls this; the second call onwards is free.
  unlock() {
    if (this.ready) {
      if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return false;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(ctx.destination);

      // A short synthetic room. Only the music and the reward stingers go
      // through it — footsteps and UI clicks stay dry so they read as close.
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._makeImpulse(1.9, 2.6);
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.5;
      this.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.master);

      // Reverb must stay behind the same buses as the dry signal. Directly
      // sending music or effects to the shared reverb would bypass their
      // volume controls and keep tails audible while recording.
      this.musicReverbGain = ctx.createGain();
      this.musicReverbGain.gain.value = 0;
      this.musicReverbGain.connect(this.reverb);
      this.sfxReverbGain = ctx.createGain();
      this.sfxReverbGain.gain.value = this.sfxVolume;
      this.sfxReverbGain.connect(this.reverb);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);

      this.ambienceGain = ctx.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambienceGain.connect(this.master);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = SFX_BASE * this.sfxVolume;
      this.sfxGain.connect(this.master);

      this._noiseBuffer = this._makeNoise(2.5);
      this.ready = true;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    } catch (err) {
      this.ready = false;
      return false;
    }
  }

  _makeNoise(seconds) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this._persist();
    if (!this.ready) {
      if (this.enabled) this.unlock();
      else return this.enabled;
    }
    if (this.ready) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.enabled ? 1 : 0, now, 0.06);
      if (this.enabled && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    }
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  setMusicVolume(value) {
    this.musicVolume = clamp01(value);
    this._persist();
    this._applyMusicLevel(true);
  }

  setSfxVolume(value) {
    this.sfxVolume = clamp01(value);
    this._persist();
    if (this.ready) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.setTargetAtTime(SFX_BASE * this.sfxVolume, now, 0.05);
      this.sfxReverbGain?.gain.setTargetAtTime(this.sfxVolume, now, 0.05);
    }
  }

  _persist() {
    writeStoredSettings({ enabled: this.enabled, music: this.musicVolume, sfx: this.sfxVolume });
  }

  // Named ducks stack: the chart being open and a recording running are two
  // independent reasons to pull the bed down, and releasing one must not undo
  // the other.
  duck(reason, active) {
    const wasVoiceLocked = this._voiceLock;
    if (active) this._ducks.add(reason);
    else this._ducks.delete(reason);
    if (reason === "recording") this._voiceLock = Boolean(active);
    if (reason === "recording" && !active && wasVoiceLocked && this.ready) {
      // Do not replay every beat that accumulated while the microphone was
      // live; restart the bed just ahead of the next fresh beat.
      this._nextBeat = this.ctx.currentTime + 0.25;
    }
    this._applyMusicLevel(reason === "recording");
  }

  isDucked(reason) {
    return this._ducks.has(reason);
  }

  // While the microphone is live nothing plays at all — a duck to 12 % would
  // still be in the recording. Everything else is a gentle attenuation.
  _duckFactor() {
    if (this._ducks.has("recording") || this._ducks.has("hidden-tab")) return 0;
    let factor = 1;
    if (this._ducks.has("chart")) factor *= 0.35;
    if (this._ducks.has("menu")) factor *= 0.75;
    if (this._ducks.has("hidden")) factor *= 0.9;
    return factor;
  }

  _applyMusicLevel(immediate = false) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const factor = this._duckFactor();
    const music = this._mood ? MUSIC_BASE * this.musicVolume * factor : 0;
    const ambience = this._ambience ? AMBIENCE_BASE * this.musicVolume * factor : 0;
    const musicReverb = music * MUSIC_REVERB_SEND;
    // Fading out has to be quick enough that the first spoken word is already
    // clean; fading back in is slow so it never announces itself.
    const attack = immediate || factor === 0 ? 0.01 : 0.9;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(music, now, attack);
    this.musicReverbGain?.gain.cancelScheduledValues(now);
    this.musicReverbGain?.gain.setTargetAtTime(musicReverb, now, attack);
    this.ambienceGain.gain.cancelScheduledValues(now);
    this.ambienceGain.gain.setTargetAtTime(ambience, now, attack);
  }

  // ---------------------------------------------------------------- music

  playMusic(moodId) {
    if (!this.unlock()) return;
    const mood = MOODS[moodId] || MOODS.menu;
    if (this._mood === mood && this._scheduler) {
      this._applyMusicLevel();
      return;
    }
    this._mood = mood;
    this._beatIndex = 0;
    this._nextBeat = this.ctx.currentTime + 0.25;
    this._applyMusicLevel();
    if (this._scheduler) return;
    this._scheduler = setInterval(() => this._scheduleMusic(), SCHEDULE_INTERVAL_MS);
    this._scheduleMusic();
  }

  stopMusic() {
    this._mood = null;
    if (this._scheduler) {
      clearInterval(this._scheduler);
      this._scheduler = null;
    }
    this._applyMusicLevel(true);
  }

  _scheduleMusic() {
    const mood = this._mood;
    if (!mood || !this.ready) return;
    if (this._voiceLock || this._ducks.has("hidden-tab") || this.musicVolume <= 0) return;
    if (this.ctx.state === "suspended") return;
    const horizon = this.ctx.currentTime + SCHEDULE_LOOKAHEAD;
    let guard = 0;
    while (this._nextBeat < horizon && guard++ < 16) {
      this._emitBeat(mood, this._nextBeat, this._beatIndex);
      this._nextBeat += mood.beat;
      this._beatIndex += 1;
    }
  }

  _emitBeat(mood, when, index) {
    const scale = SCALES[mood.scale] || SCALES.majorPentatonic;
    // A pad chord every eight beats holds the harmony; the bells drift over it.
    if (index % 8 === 0) this._pad(mood, when, scale);
    if (Math.random() < mood.density) {
      const degree = scale[Math.floor(Math.random() * scale.length)];
      this._bell(mood, when + Math.random() * 0.12, midiToFreq(mood.root + 12 + degree));
    }
    if (index % 16 === 8 && Math.random() < 0.6) {
      const degree = scale[Math.floor(Math.random() * 3)];
      this._bell(mood, when, midiToFreq(mood.root + 24 + degree), 0.55);
    }
  }

  _pad(mood, when, scale) {
    const ctx = this.ctx;
    const duration = mood.beat * 8.4;
    const chord = [0, scale[2] ?? 4, scale[4] ?? 7];
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setValueAtTime(0.0001, when);
    bus.gain.linearRampToValueAtTime(mood.padGain, when + duration * 0.35);
    bus.gain.linearRampToValueAtTime(0.0001, when + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(mood.cutoff * 0.6, when);
    filter.frequency.linearRampToValueAtTime(mood.cutoff, when + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(mood.cutoff * 0.5, when + duration);
    filter.Q.value = 0.8;

    bus.connect(filter);
    filter.connect(this.musicGain);
    filter.connect(this.musicReverbGain);

    const stops = [];
    for (const semitone of chord) {
      for (const detune of [-mood.detune, mood.detune]) {
        const osc = ctx.createOscillator();
        osc.type = mood.padType;
        osc.frequency.value = midiToFreq(mood.root + semitone);
        osc.detune.value = detune;
        const voice = ctx.createGain();
        voice.gain.value = 0.18;
        osc.connect(voice);
        voice.connect(bus);
        osc.start(when);
        osc.stop(when + duration + 0.1);
        stops.push(osc);
      }
    }
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = midiToFreq(mood.root - 12);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.2;
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(when);
    sub.stop(when + duration + 0.1);
    stops[stops.length - 1].onended = () => {
      bus.disconnect();
      filter.disconnect();
    };
  }

  _bell(mood, when, freq, gainScale = 1) {
    const ctx = this.ctx;
    const duration = 2.4;
    const osc = ctx.createOscillator();
    osc.type = mood.bellType;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(mood.bellGain * gainScale, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    gain.connect(this.musicReverbGain);
    osc.start(when);
    osc.stop(when + duration + 0.05);
    osc.onended = () => gain.disconnect();
  }

  // ------------------------------------------------------------- ambience

  playAmbience(levelId) {
    if (!this.unlock()) return;
    const spec = AMBIENCES[levelId];
    this.stopAmbience();
    if (!spec) {
      this._applyMusicLevel();
      return;
    }
    const ctx = this.ctx;
    const nodes = [];

    if (spec.wind) {
      const source = ctx.createBufferSource();
      source.buffer = this._noiseBuffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = spec.wind.cutoff;
      filter.Q.value = spec.wind.q;
      const gain = ctx.createGain();
      gain.gain.value = spec.wind.gain;
      // A slow LFO on the band centre is what turns flat noise into weather.
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = spec.wind.sweep;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = spec.wind.cutoff * 0.45;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambienceGain);
      source.start();
      lfo.start();
      nodes.push(source, lfo);
    }

    if (spec.rumble) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = spec.rumble.freq;
      const gain = ctx.createGain();
      gain.gain.value = spec.rumble.gain;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.09;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = spec.rumble.gain * 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.ambienceGain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    }

    this._ambience = { nodes, crackle: spec.crackle || null, nextCrackle: 0 };
    this._applyMusicLevel();
  }

  stopAmbience() {
    if (!this._ambience) return;
    for (const node of this._ambience.nodes) {
      try {
        node.stop();
      } catch (err) {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch (err) {
        /* already disconnected */
      }
    }
    this._ambience = null;
    if (this.ready) this._applyMusicLevel();
  }

  // Driven from the render loop. Fire crackle is scheduled here rather than in
  // the music scheduler because it is per-frame random, not on a beat grid.
  update(dt) {
    const ambience = this._ambience;
    if (!ambience?.crackle || !this.ready || this._voiceLock || !this.enabled) return;
    ambience.nextCrackle -= dt;
    if (ambience.nextCrackle > 0) return;
    ambience.nextCrackle = (0.35 + Math.random() * 1.4) / Math.max(0.2, ambience.crackle.rate / 6);
    this._crackle(ambience.crackle.gain);
  }

  _crackle(gainScale) {
    const ctx = this.ctx;
    const when = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.playbackRate.value = 0.7 + Math.random() * 1.6;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 + Math.random() * 2400;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    const peak = (0.1 + Math.random() * 0.22) * gainScale;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07 + Math.random() * 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);
    source.start(when, Math.random() * 2, 0.2);
    source.onended = () => gain.disconnect();
  }

  // ------------------------------------------------------------------ sfx

  _tone({ freq = 440, to = null, dur = 0.12, type = "square", gain = 0.3, delay = 0, attack = 0.005, reverb = 0 }) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp);
    amp.connect(this.sfxGain);
    if (reverb > 0) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      amp.connect(send);
      send.connect(this.sfxReverbGain);
    }
    osc.start(when);
    osc.stop(when + dur + 0.02);
    osc.onended = () => amp.disconnect();
  }

  _burst({ dur = 0.12, filter = "bandpass", freq = 800, to = null, q = 1, gain = 0.3, delay = 0, rate = 1 }) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.playbackRate.value = rate;
    const band = ctx.createBiquadFilter();
    band.type = filter;
    band.frequency.setValueAtTime(freq, when);
    if (to && to !== freq) band.frequency.exponentialRampToValueAtTime(Math.max(30, to), when + dur);
    band.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    source.connect(band);
    band.connect(amp);
    amp.connect(this.sfxGain);
    source.start(when, Math.random() * 2, dur + 0.05);
    source.onended = () => amp.disconnect();
  }

  // A single named entry point keeps every caller out of the synthesis detail.
  play(name, options = {}) {
    if (!this.ready || !this.enabled) return;
    // Nothing but the recording indicator itself may sound while the mic runs.
    if (this._voiceLock && name !== "record-stop") return;
    const material = options.material || "default";
    switch (name) {
      case "ui-click":
        this._tone({ freq: 660, to: 880, dur: 0.06, type: "square", gain: 0.16 });
        break;
      case "ui-confirm":
        this._tone({ freq: 587, dur: 0.09, type: "square", gain: 0.2 });
        this._tone({ freq: 880, dur: 0.13, type: "square", gain: 0.18, delay: 0.08 });
        break;
      case "ui-back":
        this._tone({ freq: 420, to: 280, dur: 0.12, type: "triangle", gain: 0.18 });
        break;
      case "hotbar":
        this._tone({ freq: 1000 + (options.index || 0) * 120, dur: 0.045, type: "square", gain: 0.12 });
        break;
      case "step":
        this._step(material, options.sprinting);
        break;
      case "jump":
        this._burst({ dur: 0.09, freq: 380, to: 700, q: 0.8, gain: 0.14, rate: 1.4 });
        break;
      case "land":
        this._burst({ dur: 0.14, filter: "lowpass", freq: 480, to: 160, gain: 0.26 * clamp01(options.strength ?? 1) + 0.08, rate: 0.9 });
        break;
      case "break-tick":
        this._burst({ dur: 0.05, freq: 1100 + Math.random() * 600, q: 2.5, gain: 0.1, rate: 1.3 });
        break;
      case "break":
        this._breakSound(material);
        break;
      case "place":
        this._burst({ dur: 0.12, filter: "lowpass", freq: 900, to: 240, gain: 0.24, rate: 0.8 });
        this._tone({ freq: 180, to: 120, dur: 0.1, type: "sine", gain: 0.2 });
        break;
      case "item-use":
        this._tone({ freq: 784, dur: 0.1, type: "sine", gain: 0.24, reverb: 0.25 });
        this._tone({ freq: 1175, dur: 0.16, type: "sine", gain: 0.2, delay: 0.07, reverb: 0.3 });
        break;
      case "item-reject":
        this._tone({ freq: 200, to: 140, dur: 0.18, type: "sawtooth", gain: 0.18 });
        break;
      case "reveal":
        // Sonar: a patient nobody could see just became findable.
        this._tone({ freq: 1320, dur: 0.5, type: "sine", gain: 0.26, reverb: 0.6 });
        this._tone({ freq: 1980, dur: 0.4, type: "sine", gain: 0.14, delay: 0.1, reverb: 0.6 });
        break;
      case "ping": {
        // Proximity ping for a concealed casualty: pitch rises as you close in.
        const closeness = clamp01(options.closeness ?? 0.5);
        this._tone({ freq: 620 + closeness * 900, dur: 0.07, type: "sine", gain: 0.09 + closeness * 0.1, reverb: 0.35 });
        break;
      }
      case "record-start":
        this._tone({ freq: 700, dur: 0.07, type: "sine", gain: 0.22 });
        this._tone({ freq: 1050, dur: 0.09, type: "sine", gain: 0.2, delay: 0.07 });
        break;
      case "record-stop":
        this._tone({ freq: 900, dur: 0.07, type: "sine", gain: 0.2 });
        this._tone({ freq: 600, dur: 0.11, type: "sine", gain: 0.18, delay: 0.07 });
        break;
      case "transcribed":
        this._tone({ freq: 1046, dur: 0.09, type: "triangle", gain: 0.18, reverb: 0.2 });
        break;
      case "score": {
        // Every step of a streak lifts the coin blip a whole tone, so the
        // reward is audible before the number is read.
        const step = Math.max(0, Math.min(8, Number(options.streak) || 0));
        const base = 784 * Math.pow(2, step / 12);
        this._tone({ freq: base, dur: 0.06, type: "square", gain: 0.16 });
        this._tone({ freq: base * 1.5, dur: 0.11, type: "square", gain: 0.14, delay: 0.05 });
        break;
      }
      case "saved":
        this._arpeggio([523, 659, 784, 1047], 0.075, "triangle", 0.24);
        this._burst({ dur: 0.5, filter: "highpass", freq: 2600, gain: 0.06, rate: 0.6 });
        break;
      case "partial":
        this._tone({ freq: 494, dur: 0.1, type: "triangle", gain: 0.2 });
        this._tone({ freq: 415, dur: 0.16, type: "triangle", gain: 0.18, delay: 0.09 });
        break;
      case "rejected":
        this._tone({ freq: 233, to: 175, dur: 0.24, type: "sawtooth", gain: 0.2 });
        break;
      case "dead":
        this._tone({ freq: 196, to: 98, dur: 0.7, type: "sawtooth", gain: 0.22, reverb: 0.4 });
        break;
      case "medal":
        this._arpeggio([659, 880, 1109, 1319, 1760], 0.09, "sine", 0.2, 0.5);
        break;
      case "level-complete":
        this._arpeggio([523, 659, 784, 1047, 1319], 0.11, "square", 0.2, 0.4);
        break;
      case "campaign-complete":
        this._arpeggio([523, 659, 784, 1047, 1319, 1568, 2093], 0.13, "square", 0.22, 0.5);
        this._tone({ freq: 130, dur: 1.6, type: "sine", gain: 0.24, delay: 0.1, reverb: 0.5 });
        break;
      case "countdown":
        this._tone({ freq: 880, dur: 0.06, type: "square", gain: 0.14 });
        break;
      case "mission-start":
        this._tone({ freq: 294, dur: 0.3, type: "sawtooth", gain: 0.16, reverb: 0.4 });
        this._tone({ freq: 440, dur: 0.45, type: "sawtooth", gain: 0.16, delay: 0.18, reverb: 0.4 });
        break;
      case "toast":
        this._tone({ freq: 1320, dur: 0.05, type: "sine", gain: 0.1 });
        break;
      case "warn":
        this._tone({ freq: 740, dur: 0.09, type: "square", gain: 0.16 });
        this._tone({ freq: 740, dur: 0.09, type: "square", gain: 0.16, delay: 0.14 });
        break;
      default:
        break;
    }
  }

  _arpeggio(freqs, spacing, type, gain, reverb = 0.3) {
    freqs.forEach((freq, index) => {
      this._tone({ freq, dur: 0.22, type, gain, delay: index * spacing, reverb });
    });
  }

  // Footsteps carry the surface: snow is a soft high hiss, metal rings, stone
  // is a dry click. It is the cheapest way to make a voxel world feel material.
  _step(material, sprinting) {
    const profiles = {
      snow: { freq: 2600, q: 0.9, dur: 0.09, gain: 0.1, rate: 1.5 },
      ice: { freq: 3200, q: 4, dur: 0.07, gain: 0.11, rate: 1.7 },
      metal: { freq: 1800, q: 5, dur: 0.09, gain: 0.1, rate: 1.2 },
      wood: { freq: 900, q: 2, dur: 0.08, gain: 0.12, rate: 1 },
      grass: { freq: 1500, q: 1.2, dur: 0.08, gain: 0.09, rate: 1.2 },
      gravel: { freq: 2000, q: 1.4, dur: 0.09, gain: 0.11, rate: 1.3 },
      water: { freq: 700, q: 0.8, dur: 0.16, gain: 0.13, rate: 0.7 },
      default: { freq: 1200, q: 1.5, dur: 0.08, gain: 0.1, rate: 1.1 },
    };
    const profile = profiles[material] || profiles.default;
    const jitter = 0.85 + Math.random() * 0.3;
    this._burst({
      dur: profile.dur,
      freq: profile.freq * jitter,
      to: profile.freq * 0.5,
      q: profile.q,
      gain: profile.gain * (sprinting ? 1.25 : 1),
      rate: profile.rate * jitter,
    });
  }

  _breakSound(material) {
    const profiles = {
      glass: { freq: 3400, q: 3, dur: 0.28, gain: 0.24, rate: 1.6, tone: 2400 },
      metal: { freq: 1400, q: 6, dur: 0.3, gain: 0.22, rate: 1.1, tone: 520 },
      stone: { freq: 700, q: 1.4, dur: 0.24, gain: 0.26, rate: 0.9, tone: 190 },
      wood: { freq: 900, q: 2, dur: 0.2, gain: 0.24, rate: 1, tone: 260 },
      snow: { freq: 2400, q: 0.8, dur: 0.2, gain: 0.18, rate: 1.4, tone: null },
      grass: { freq: 1600, q: 1, dur: 0.16, gain: 0.2, rate: 1.2, tone: null },
      gravel: { freq: 1800, q: 1.2, dur: 0.22, gain: 0.22, rate: 1.2, tone: null },
      default: { freq: 1100, q: 1.4, dur: 0.2, gain: 0.22, rate: 1, tone: 220 },
    };
    const profile = profiles[material] || profiles.default;
    this._burst({ dur: profile.dur, freq: profile.freq, to: profile.freq * 0.35, q: profile.q, gain: profile.gain, rate: profile.rate });
    if (profile.tone) this._tone({ freq: profile.tone, to: profile.tone * 0.6, dur: profile.dur * 0.8, type: "triangle", gain: 0.12 });
  }

  // Footstep cadence lives here so both the keyboard and the touch stick get
  // the same rhythm without either input path knowing about audio.
  stepTick(dt, { moving, grounded, sprinting, material }) {
    if (!moving || !grounded) {
      this._stepPhase = 0.62;
      return;
    }
    this._stepPhase += dt * (sprinting ? 2.5 : 1.85);
    if (this._stepPhase < 0.62) return;
    this._stepPhase = 0;
    this.play("step", { material, sprinting });
  }

  dispose() {
    this.stopMusic();
    this.stopAmbience();
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
    this.ready = false;
  }
}

export const MUSIC_MOODS = Object.freeze(Object.keys(MOODS));
