import type { HitJudgement, ItemType, LevelDefinition } from './types';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 100% Procedural Web Audio Rhythm Synthesizer & Beat Clock.
 * Schedules warm bistro groove percussion, walking bass, Rhodes chords,
 * and 10 distinct melodic tableware hit sounds synchronized to the beat.
 */
export class RhythmAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private activeLevel: LevelDefinition | null = null;
  private running = false;
  private paused = false;

  // Audio-synced timeline
  private startAudioTime = 0;
  private pausedBeat = 0;
  private fallbackStartMs = 0;
  private lastScheduledStep = -1;

  public ensureInitialized(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.78;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.56;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate 0.5s white noise buffer for brushes, snares, foam fizz & cork pops
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(sr * 0.5), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.78, this.ctx.currentTime, 0.02);
    }
  }

  public startTrack(level: LevelDefinition): void {
    this.ensureInitialized();
    this.activeLevel = level;
    this.running = true;
    this.paused = false;
    this.pausedBeat = 0;
    this.lastScheduledStep = -1;

    if (this.ctx) {
      this.startAudioTime = this.ctx.currentTime + 0.08;
    }
    this.fallbackStartMs = performance.now() + 80;
  }

  public pause(): void {
    if (!this.running || this.paused) return;
    this.pausedBeat = this.getCurrentBeat();
    this.paused = true;
  }

  public resume(): void {
    if (!this.running || !this.paused || !this.activeLevel) return;
    this.ensureInitialized();
    const secPerBeat = 60 / this.activeLevel.bpm;
    if (this.ctx) {
      this.startAudioTime = this.ctx.currentTime - this.pausedBeat * secPerBeat;
    }
    this.fallbackStartMs = performance.now() - this.pausedBeat * secPerBeat * 1000;
    this.lastScheduledStep = Math.floor(this.pausedBeat * 2);
    this.paused = false;
  }

  public stop(): void {
    this.running = false;
    this.paused = false;
    this.activeLevel = null;
    this.lastScheduledStep = -1;
  }

  public getCurrentBeat(): number {
    if (!this.activeLevel || !this.running) return 0;
    if (this.paused) return this.pausedBeat;

    const secPerBeat = 60 / this.activeLevel.bpm;
    if (this.ctx && this.ctx.state === 'running') {
      return (this.ctx.currentTime - this.startAudioTime) / secPerBeat;
    }
    return (performance.now() - this.fallbackStartMs) / 1000 / secPerBeat;
  }

  /** Called every frame by the game loop to look ahead 140ms and schedule groove steps */
  public update(): void {
    if (!this.running || this.paused || !this.activeLevel || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    const level = this.activeLevel;
    const secPerBeat = 60 / level.bpm;
    const secPerEighth = secPerBeat / 2;
    const now = this.ctx.currentTime;
    const lookaheadEnd = now + 0.14;

    const maxEighth = Math.floor((lookaheadEnd - this.startAudioTime) / secPerEighth);
    const totalTrackEighths = (level.durationBeats + 8) * 2;

    for (let step = this.lastScheduledStep + 1; step <= maxEighth; step++) {
      if (step < 0 || step > totalTrackEighths) continue;
      const stepTime = this.startAudioTime + step * secPerEighth;
      if (stepTime >= now - 0.04) {
        this.scheduleGrooveStep(step, stepTime, level);
      }
      this.lastScheduledStep = step;
    }
  }

  private scheduleGrooveStep(eighthStep: number, time: number, level: LevelDefinition): void {
    if (!this.ctx || !this.musicGain) return;
    const beatInBar = Math.floor(eighthStep / 2) % 4;
    const isOffbeat = eighthStep % 2 === 1;
    const barIndex = Math.floor(eighthStep / 8);
    const chord = level.chordProgression[barIndex % level.chordProgression.length];

    // Kick drum
    const kickHit =
      (!isOffbeat && (beatInBar === 0 || beatInBar === 2)) ||
      (level.grooveStyle === 'funk' && isOffbeat && beatInBar === 1) ||
      (level.grooveStyle === 'finale' && !isOffbeat);
    if (kickHit) {
      this.playKick(time, beatInBar === 0 ? 0.55 : 0.42);
    }

    // Snare / Brush on 2 and 4
    if (!isOffbeat && (beatInBar === 1 || beatInBar === 3)) {
      this.playBrushSnare(time, level.grooveStyle === 'polka' ? 0.34 : 0.26);
    }

    // Hi-hat groove
    if (isOffbeat || level.grooveStyle === 'swing' || level.grooveStyle === 'finale') {
      this.playHiHat(time, isOffbeat ? 0.12 : 0.07);
    }

    // Bassline
    if (!isOffbeat) {
      const bassMidi =
        beatInBar === 0
          ? chord[0] - 12
          : beatInBar === 2
            ? chord[2] - 12
            : beatInBar === 1 && level.grooveStyle === 'polka'
              ? chord[1] - 12
              : chord[0] - 12 + (beatInBar === 3 ? 7 : 0);
      if (beatInBar === 0 || beatInBar === 2 || level.grooveStyle === 'polka' || level.grooveStyle === 'funk') {
        this.playBass(time, midiToFreq(bassMidi), (60 / level.bpm) * 0.72);
      }
    }

    // Warm Electric Piano / Rhodes chord comping on bar start and syncopation
    if ((!isOffbeat && beatInBar === 0) || (isOffbeat && beatInBar === 1 && level.grooveStyle !== 'waltz')) {
      this.playChordPad(time, chord, (60 / level.bpm) * 1.4, beatInBar === 0 ? 0.14 : 0.08);
    }
  }

  private playKick(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.11);

    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private playBrushSnare(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900, time);
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.14);
  }

  private playHiHat(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.05);
  }

  private playBass(time: number, freq: number, duration: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.32, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playChordPad(time: number, midis: number[], duration: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain) return;
    for (let i = 0; i < midis.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midis[i] + 12), time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(gainAmt / midis.length, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + duration + 0.03);
    }
  }

  /** Plays a distinct musical timbre for each of the 10 tableware items on hit */
  public playItemHit(item: ItemType, midiNote: number, judgement: HitJudgement, isUnique: boolean): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = midiToFreq(midiNote);
    const boost = isUnique ? 1.25 : 1.0;
    const vol = (judgement === 'perfect' ? 0.34 : judgement === 'great' ? 0.28 : 0.22) * boost;

    switch (item) {
      case 'knife': {
        // Bright steel blade ping + harmonic overtone
        this.triggerTone(now, baseFreq * 2, 'triangle', vol * 0.8, 0.24);
        this.triggerTone(now, baseFreq * 3.01, 'sine', vol * 0.45, 0.16);
        break;
      }
      case 'fork': {
        // Pure resonant tuning-fork dual sine
        this.triggerTone(now, baseFreq * 2, 'sine', vol * 0.9, 0.42);
        this.triggerTone(now, baseFreq * 4, 'sine', vol * 0.32, 0.28);
        break;
      }
      case 'spoon': {
        // Warm rounded chime bell
        this.triggerTone(now, baseFreq * 1.5, 'sine', vol * 0.85, 0.34);
        this.triggerTone(now, baseFreq * 2.5, 'triangle', vol * 0.35, 0.18);
        break;
      }
      case 'cloth': {
        // Soft percussive brush swish + warm marimba note
        this.playBrushSnare(now, vol * 0.45);
        this.triggerTone(now, baseFreq, 'triangle', vol * 0.9, 0.2);
        break;
      }
      case 'plate': {
        // Clean ceramic porcelain double chime
        this.triggerTone(now, baseFreq, 'sine', vol * 0.8, 0.32);
        this.triggerTone(now, baseFreq * 2.756, 'sine', vol * 0.35, 0.18);
        break;
      }
      case 'water': {
        // Liquid crystal droplet pitch glide + shimmering glass
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * 1.4, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.08);
        g.gain.setValueAtTime(vol * 0.85, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.34);
        break;
      }
      case 'beer': {
        // Hearty mug clink + warm brassy fifth chord
        this.triggerTone(now, baseFreq, 'sawtooth', vol * 0.36, 0.26, 1100);
        this.triggerTone(now, baseFreq * 1.5, 'triangle', vol * 0.55, 0.3);
        this.triggerTone(now, baseFreq * 3.2, 'sine', vol * 0.28, 0.14);
        break;
      }
      case 'shot': {
        // Sharp crystal glass ting
        this.triggerTone(now, baseFreq * 2.5, 'sine', vol * 0.85, 0.22);
        this.triggerTone(now, baseFreq * 5.02, 'sine', vol * 0.3, 0.12);
        break;
      }
      case 'napkin': {
        // Silky airy arpeggiated harp bloom
        this.triggerTone(now, baseFreq, 'sine', vol * 0.65, 0.35);
        this.triggerTone(now + 0.03, baseFreq * 1.25, 'sine', vol * 0.55, 0.35);
        this.triggerTone(now + 0.06, baseFreq * 1.5, 'sine', vol * 0.5, 0.38);
        break;
      }
      case 'wine': {
        // Cork pop transient + grand resonant chord
        const pop = this.ctx.createOscillator();
        const popG = this.ctx.createGain();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(220, now);
        pop.frequency.exponentialRampToValueAtTime(640, now + 0.045);
        popG.gain.setValueAtTime(vol * 0.85, now);
        popG.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        pop.connect(popG);
        popG.connect(this.sfxGain);
        pop.start(now);
        pop.stop(now + 0.08);

        this.triggerTone(now + 0.02, baseFreq, 'triangle', vol * 0.72, 0.45);
        this.triggerTone(now + 0.02, baseFreq * 1.5, 'sine', vol * 0.55, 0.48);
        this.triggerTone(now + 0.02, baseFreq * 2, 'sine', vol * 0.42, 0.44);
        break;
      }
    }

    // Extra harmonic sparkle for level's unique signature note
    if (isUnique && judgement === 'perfect') {
      this.triggerTone(now + 0.025, baseFreq * 3, 'sine', 0.16, 0.35);
    }
  }

  public playMiss(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;

    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playUiSelect(pitchMidi = 67): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain) return;
    this.triggerTone(this.ctx.currentTime, midiToFreq(pitchMidi), 'sine', 0.16, 0.14);
  }

  public playVictoryFanfare(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [60, 64, 67, 72, 76];
    notes.forEach((m, i) => {
      this.triggerTone(now + i * 0.09, midiToFreq(m), 'triangle', 0.24, 0.55);
      this.triggerTone(now + i * 0.09, midiToFreq(m + 12), 'sine', 0.12, 0.5);
    });
  }

  public playGameOverCadence(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [57, 55, 53, 50];
    notes.forEach((m, i) => {
      this.triggerTone(now + i * 0.14, midiToFreq(m), 'triangle', 0.2, 0.42);
    });
  }

  private triggerTone(
    time: number,
    freq: number,
    type: OscillatorType,
    gainAmt: number,
    duration: number,
    lowpassHz?: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    if (lowpassHz) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassHz;
      osc.connect(filter);
      filter.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
