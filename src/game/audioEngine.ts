import { DEFAULT_MUSIC_TRACK_ID, getMusicTrackById } from './musicLibrary';
import type { HitJudgement, ItemType, LevelDefinition, MusicStyle, MusicTrack } from './types';
import { YouTubeMusicController, type YouTubeAudioState } from './youtubePlayer';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Hybrid YouTube Audio Library (R&B / Diskotéka / Dubstep) + Modern Sci-Fi SFX Engine.
 * - Streams any of the 10 curated R&B, Disco, and Dubstep tracks starting directly in the music.
 * - Maintains a rock-solid Web Audio beat clock & style-matched offline fallback groove
 *   (auto-ducks to 0 when YouTube audio enters PLAYING).
 * - Synthesizes crisp, modern sci-fi laser, plasma pulse, and photon beam hit sounds
 *   harmonically locked to the active track's key & scale, plus sci-fi energy-drain miss SFX.
 */
export class RhythmAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private yt: YouTubeMusicController;
  private ytState: YouTubeAudioState = 'idle';

  private muted = false;
  private activeLevel: LevelDefinition | null = null;
  private activeTrack: MusicTrack = getMusicTrackById(DEFAULT_MUSIC_TRACK_ID);
  private previewingTrack: MusicTrack | null = null;

  private running = false;
  private paused = false;

  // Audio-synced timeline
  private startAudioTime = 0;
  private pausedBeat = 0;
  private fallbackStartMs = 0;
  private lastScheduledStep = -1;

  constructor() {
    this.yt = new YouTubeMusicController((state) => {
      this.ytState = state;
      this.syncFallbackMusicGain();
    });
  }

  public ensureInitialized(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.52;
      this.musicGain.connect(this.masterGain);

      // Punchy modern sci-fi SFX bus with dynamics compression so rapid laser/plasma hits never clip
      this.sfxCompressor = this.ctx.createDynamicsCompressor();
      this.sfxCompressor.threshold.value = -13;
      this.sfxCompressor.knee.value = 10;
      this.sfxCompressor.ratio.value = 5.5;
      this.sfxCompressor.attack.value = 0.002;
      this.sfxCompressor.release.value = 0.075;
      this.sfxCompressor.connect(this.masterGain);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.94;
      this.sfxBus.connect(this.sfxCompressor);

      // Pre-generate 0.5s white noise buffer for plasma sizzle, ion static & drums
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

  private syncFallbackMusicGain(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const target = this.ytState === 'playing' ? 0.0 : 0.52;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(target, now, 0.09);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    this.yt.setMuted(mute);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
  }

  public getActiveTrack(): MusicTrack {
    return this.activeTrack;
  }

  public getActiveBpm(): number {
    return this.activeTrack.bpm;
  }

  public cueMusicTrack(track: MusicTrack): void {
    this.activeTrack = track;
    if (!this.running && !this.previewingTrack) {
      this.yt.cueTrack(track.youtubeId, track.startSeconds);
    }
  }

  public startPreview(track: MusicTrack): void {
    this.ensureInitialized();
    this.activeTrack = track;
    this.previewingTrack = track;
    this.yt.playTrack(track.youtubeId, track.startSeconds, true);
  }

  public stopPreview(): void {
    if (!this.previewingTrack) return;
    this.previewingTrack = null;
    if (!this.running) {
      this.yt.stop();
    }
  }

  public startTrack(level: LevelDefinition, track: MusicTrack): void {
    this.ensureInitialized();
    this.previewingTrack = null;
    this.activeLevel = level;
    this.activeTrack = track;
    this.running = true;
    this.paused = false;
    this.pausedBeat = 0;
    this.lastScheduledStep = -1;

    if (this.ctx) {
      this.startAudioTime = this.ctx.currentTime + 0.08;
    }
    this.fallbackStartMs = performance.now() + 80;

    this.yt.playTrack(track.youtubeId, track.startSeconds, true);
    this.syncFallbackMusicGain();
  }

  public pause(): void {
    if (!this.running || this.paused) return;
    this.pausedBeat = this.getCurrentBeat();
    this.paused = true;
    this.yt.pause();
  }

  public resume(): void {
    if (!this.running || !this.paused || !this.activeLevel) return;
    this.ensureInitialized();
    const secPerBeat = 60 / this.activeTrack.bpm;
    if (this.ctx) {
      this.startAudioTime = this.ctx.currentTime - this.pausedBeat * secPerBeat;
    }
    this.fallbackStartMs = performance.now() - this.pausedBeat * secPerBeat * 1000;
    this.lastScheduledStep = Math.floor(this.pausedBeat * 2);
    this.paused = false;
    this.yt.resume();
    this.syncFallbackMusicGain();
  }

  public stop(): void {
    this.running = false;
    this.paused = false;
    this.activeLevel = null;
    this.lastScheduledStep = -1;
    this.yt.stop();
  }

  public getCurrentBeat(): number {
    if (!this.activeLevel || !this.running) return 0;
    if (this.paused) return this.pausedBeat;

    const secPerBeat = 60 / this.activeTrack.bpm;
    if (this.ctx && this.ctx.state === 'running') {
      return (this.ctx.currentTime - this.startAudioTime) / secPerBeat;
    }
    return (performance.now() - this.fallbackStartMs) / 1000 / secPerBeat;
  }

  public update(): void {
    if (!this.running || this.paused || !this.activeLevel || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    const level = this.activeLevel;
    const track = this.activeTrack;
    const secPerBeat = 60 / track.bpm;
    const secPerEighth = secPerBeat / 2;
    const now = this.ctx.currentTime;
    const lookaheadEnd = now + 0.14;

    const maxEighth = Math.floor((lookaheadEnd - this.startAudioTime) / secPerEighth);
    const totalTrackEighths = (level.durationBeats + 8) * 2;
    const ytActive = this.ytState === 'playing';

    for (let step = this.lastScheduledStep + 1; step <= maxEighth; step++) {
      if (step < 0 || step > totalTrackEighths) continue;
      if (!ytActive) {
        const stepTime = this.startAudioTime + step * secPerEighth;
        if (stepTime >= now - 0.04) {
          this.scheduleFallbackGrooveStep(step, stepTime, track);
        }
      }
      this.lastScheduledStep = step;
    }
  }

  /**
   * Offline / buffering fallback grooves strictly tailored to R&B, Diskotéka, and Dubstep.
   */
  private scheduleFallbackGrooveStep(eighthStep: number, time: number, track: MusicTrack): void {
    if (!this.ctx || !this.musicGain) return;
    const beatInBar = Math.floor(eighthStep / 2) % 4;
    const isOffbeat = eighthStep % 2 === 1;
    const barIndex = Math.floor(eighthStep / 8);
    const chord = track.chordProgression[barIndex % track.chordProgression.length];
    const style: MusicStyle = track.style;

    if (style === 'dubstep') {
      // Heavy half-time Dubstep beat (sub kick on 1 & 3.5, huge snare on 3) + wobble bass from beat 0
      if ((!isOffbeat && beatInBar === 0) || (isOffbeat && beatInBar === 3)) {
        this.playKick(time, 0.64);
      }
      if (!isOffbeat && beatInBar === 2) {
        this.playModernSnare(time, 0.44);
      }
      this.playHiHat(time, isOffbeat ? 0.13 : 0.07);
      if (!isOffbeat && (beatInBar === 0 || beatInBar === 2)) {
        this.playDubstepWobbleBass(time, midiToFreq(chord[0] - 12), (60 / track.bpm) * 1.9, track.bpm);
      }
      if (!isOffbeat && beatInBar === 0) {
        this.playChordPad(time, chord, (60 / track.bpm) * 1.6, 0.12);
      }
    } else if (style === 'disco') {
      // Four-on-the-floor Diskotéka groove + offbeat open hat + funky octave bass
      if (!isOffbeat) {
        this.playKick(time, beatInBar === 0 ? 0.58 : 0.48);
      }
      if (!isOffbeat && (beatInBar === 1 || beatInBar === 3)) {
        this.playModernSnare(time, 0.3);
      }
      if (isOffbeat) {
        this.playHiHat(time, 0.15);
      }
      const bassMidi = isOffbeat ? chord[0] : chord[0] - 12;
      this.playBass(time, midiToFreq(bassMidi), (60 / track.bpm) * 0.4, 'disco');
      if ((!isOffbeat && beatInBar === 0) || (isOffbeat && beatInBar === 1)) {
        this.playChordPad(time, chord, (60 / track.bpm) * 0.9, 0.14);
      }
    } else {
      // Smooth syncopated modern R&B pocket + lush warm chords
      if ((!isOffbeat && beatInBar === 0) || (isOffbeat && (beatInBar === 1 || beatInBar === 2))) {
        this.playKick(time, beatInBar === 0 ? 0.55 : 0.38);
      }
      if (!isOffbeat && (beatInBar === 1 || beatInBar === 3)) {
        this.playModernSnare(time, 0.24);
      }
      if (isOffbeat || beatInBar === 0 || beatInBar === 2) {
        this.playHiHat(time, isOffbeat ? 0.09 : 0.05);
      }
      if (!isOffbeat && (beatInBar === 0 || beatInBar === 2)) {
        this.playBass(time, midiToFreq(chord[0] - 12), (60 / track.bpm) * 1.3, 'rnb');
      }
      if (!isOffbeat && beatInBar === 0) {
        this.playChordPad(time, chord, (60 / track.bpm) * 2.4, 0.16);
      }
    }
  }

  private playKick(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.1);

    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.21);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private playModernSnare(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.13);
  }

  private playHiHat(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7600, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.05);
  }

  private playDubstepWobbleBass(time: number, freq: number, duration: number, bpm: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.value = 6.0;
    filter.frequency.setValueAtTime(480, time);

    // Rhythmic wobble synced to track BPM (3 wobbles per beat)
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime((bpm / 60) * 2, time);
    lfoGain.gain.setValueAtTime(380, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.34, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    lfo.start(time);
    osc.start(time);
    lfo.stop(time + duration + 0.02);
    osc.stop(time + duration + 0.02);
  }

  private playBass(time: number, freq: number, duration: number, style: MusicStyle): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = style === 'dubstep' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'dubstep' ? 540 : style === 'disco' ? 620 : 340, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.32, time + 0.012);
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

  private quantizeToActiveScale(midiNote: number): number {
    const track = this.activeTrack;
    const rel = midiNote - track.rootMidi;
    const octave = Math.floor(rel / 12);
    const semi = ((rel % 12) + 12) % 12;

    let bestInterval = track.scaleIntervals[0];
    let bestDist = 99;
    for (let i = 0; i < track.scaleIntervals.length; i++) {
      const iv = track.scaleIntervals[i] % 12;
      const d = Math.abs(iv - semi);
      if (d < bestDist) {
        bestDist = d;
        bestInterval = iv;
      }
    }
    return track.rootMidi + octave * 12 + bestInterval;
  }

  /**
   * Plays a modern sci-fi laser / plasma / photon energy hit sound
   * harmonically locked to the currently playing DnB / Diskotéka / R&B track.
   */
  public playItemHit(item: ItemType, midiNote: number, judgement: HitJudgement, isUnique: boolean): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const lockedMidi = this.quantizeToActiveScale(midiNote);
    const baseFreq = midiToFreq(lockedMidi);

    const judgeVol = judgement === 'perfect' ? 0.36 : judgement === 'great' ? 0.29 : 0.22;
    const vol = judgeVol * (isUnique ? 1.18 : 1.0);
    const brightness = judgement === 'perfect' ? 1.0 : judgement === 'great' ? 0.8 : 0.58;

    // Pair item group with signature modern sci-fi energy weapon/beam archetype
    if (item === 'knife' || item === 'fork' || item === 'spoon') {
      // LASER BEAM: fast FM pitch-zap + focused neon laser ring
      this.playSciFiLaser(now, baseFreq, vol, brightness);
    } else if (item === 'plate' || item === 'cloth' || item === 'napkin') {
      // PLASMA PULSE: dual detuned resonant plasma discharge + energy sub-kick + ion sizzle
      this.playSciFiPlasma(now, baseFreq, vol, brightness);
    } else {
      // PHOTON / ION BEAM (water, beer, shot, wine): upward-arcing crystalline photon beam + FM halo
      this.playSciFiPhoton(now, baseFreq, vol, brightness);
    }

    // Track flavor shimmer accent (blends track's preferred sci-fi color)
    if (this.activeTrack.sfxMode === 'laser' && judgement === 'perfect') {
      this.triggerLaserSweep(now + 0.01, baseFreq * 5.2, baseFreq * 2.0, 0.055, vol * 0.22, 'sine');
    } else if (this.activeTrack.sfxMode === 'plasma' && judgement === 'perfect') {
      this.playPlasmaSizzle(now, 4600, vol * 0.22, 0.045);
    }

    // Twin-Beam Hyper-Plasma Overcharge for the level's unique 2× signature object
    if (isUnique) {
      const fifthFreq = midiToFreq(lockedMidi + 7);
      const octFreq = midiToFreq(lockedMidi + 12);
      this.triggerLaserSweep(now + 0.018, fifthFreq * 2.4, fifthFreq, 0.09, vol * 0.34, 'triangle');
      if (judgement === 'perfect') {
        this.triggerLaserSweep(now + 0.042, octFreq * 0.75, octFreq * 2.0, 0.14, vol * 0.3, 'sine');
        this.playPlasmaSizzle(now + 0.015, 6200, vol * 0.26, 0.075);
      }
    }
  }

  /** Focused modern sci-fi laser zap + harmonic beam tail */
  private playSciFiLaser(time: number, baseFreq: number, vol: number, brightness: number): void {
    if (!this.ctx || !this.sfxBus) return;

    // 1. High-energy downward laser pitch-sweep with FM modulation
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(Math.min(4800, baseFreq * 5.0 * brightness + 420), time);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 1.0, time + 0.072);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(baseFreq * 3.01, time);
    modGain.gain.setValueAtTime(420 * brightness, time);
    modGain.gain.exponentialRampToValueAtTime(8, time + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3600 * brightness + 600, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(420, baseFreq * 1.8), time + 0.13);
    filter.Q.value = 2.6;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol * 0.88, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);

    mod.start(time);
    carrier.start(time);
    mod.stop(time + 0.18);
    carrier.stop(time + 0.18);

    // 2. Crisp musical neon laser core locked in key
    this.triggerLaserSweep(time, baseFreq * 3.0, baseFreq * 2.0, 0.045, vol * 0.48, 'sine');
    this.playPlasmaSizzle(time, 5200 * brightness + 800, vol * 0.24, 0.032);
  }

  /** Rich sci-fi plasma pulse: detuned resonant energy wave + punchy plasma sub-thump + ion sizzle */
  private playSciFiPlasma(time: number, baseFreq: number, vol: number, brightness: number): void {
    if (!this.ctx || !this.sfxBus) return;

    // 1. Dual detuned plasma oscillators swept through resonant lowpass filter
    const detunes = [0.992, 1.008];
    for (let i = 0; i < detunes.length; i++) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq * 1.75 * detunes[i], time);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * detunes[i], time + 0.095);

      filter.type = 'lowpass';
      filter.Q.value = 4.2;
      filter.frequency.setValueAtTime(4800 * brightness + 500, time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(320, baseFreq * 1.4), time + 0.18);

      g.gain.setValueAtTime(0.001, time);
      g.gain.linearRampToValueAtTime(vol * 0.44, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxBus);
      osc.start(time);
      osc.stop(time + 0.22);
    }

    // 2. Tight sci-fi plasma energy sub-pulse
    this.triggerLaserSweep(time, 180, 56, 0.075, vol * 0.46, 'sine');

    // 3. Ion plasma electric sizzle crackle
    this.playPlasmaSizzle(time, 4200 * brightness + 900, vol * 0.34, 0.055);
  }

  /** Sleek sci-fi photon / ion beam: upward-arcing crystalline FM sweep + glossy harmonic aura */
  private playSciFiPhoton(time: number, baseFreq: number, vol: number, brightness: number): void {
    if (!this.ctx || !this.sfxBus) return;

    // 1. Upward-ignition photon charge beam
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const g = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq * 1.25, time);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, time + 0.042);

    mod.type = 'triangle';
    mod.frequency.setValueAtTime(baseFreq * 4.02, time);
    modGain.gain.setValueAtTime(340 * brightness, time);
    modGain.gain.exponentialRampToValueAtTime(14, time + 0.16);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol * 0.78, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(this.sfxBus);

    mod.start(time);
    carrier.start(time);
    mod.stop(time + 0.24);
    carrier.stop(time + 0.24);

    // 2. High-tech shimmering laser tail
    this.triggerLaserSweep(time + 0.006, baseFreq * 4.2, baseFreq * 3.0, 0.08, vol * 0.28 * brightness, 'sine');
    this.playPlasmaSizzle(time, 5800 * brightness + 800, vol * 0.22, 0.04);
  }

  /**
   * Modern sci-fi miss / wrong-tap sound:
   * Energy shield short-circuit + resonant plasma power-down dive + brief electric static fizzle.
   */
  public playMiss(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const rootLow = midiToFreq(this.activeTrack.rootMidi - 12);

    // 1. Resonant plasma power-down pitch dive
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(Math.min(340, rootLow * 2.1), now);
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.17);

    // Rapid sci-fi glitch wobble on pitch
    mod.type = 'square';
    mod.frequency.setValueAtTime(42, now);
    modGain.gain.setValueAtTime(28, now);
    modGain.gain.exponentialRampToValueAtTime(2, now + 0.16);

    filter.type = 'lowpass';
    filter.Q.value = 3.8;
    filter.frequency.setValueAtTime(1450, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.17);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);

    mod.start(now);
    osc.start(now);
    mod.stop(now + 0.2);
    osc.stop(now + 0.2);

    // 2. Short-circuit electric plasma static sputter
    this.playPlasmaSizzle(now, 1900, 0.2, 0.075);
  }

  private triggerLaserSweep(
    time: number,
    startHz: number,
    endHz: number,
    duration: number,
    gainAmt: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, startHz), time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endHz), time + duration);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.04);

    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private playPlasmaSizzle(time: number, centerHz: number, gainAmt: number, duration: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerHz, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(600, centerHz * 0.45), time + duration);
    filter.Q.value = 2.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainAmt, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  /** Crisp futuristic holographic HUD blip locked to the active track's scale */
  public playUiSelect(pitchMidi = 67): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const locked = this.quantizeToActiveScale(pitchMidi);
    const freq = midiToFreq(locked);

    this.triggerLaserSweep(now, freq * 2.8, freq * 2.0, 0.045, 0.15, 'sine');
    this.triggerLaserSweep(now + 0.015, freq * 3.0, freq * 4.0, 0.06, 0.08, 'triangle');
  }

  /** Sci-fi rising plasma power-up victory fanfare */
  public playVictoryFanfare(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const root = this.activeTrack.rootMidi;
    const sc = this.activeTrack.scaleIntervals;
    const notes = [root + sc[0], root + sc[2], root + sc[4], root + 12, root + 12 + sc[2]];
    notes.forEach((m, i) => {
      const f = midiToFreq(m);
      this.playSciFiPhoton(now + i * 0.085, f, 0.24, 1.0);
    });
  }

  /** Sci-fi system power-down cadence on Game Over */
  public playGameOverCadence(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const root = this.activeTrack.rootMidi - 12;
    const notes = [root + 7, root + 5, root + 3, root];
    notes.forEach((m, i) => {
      const f = midiToFreq(m);
      this.triggerLaserSweep(now + i * 0.13, f * 1.4, f * 0.85, 0.14, 0.22, 'sawtooth');
    });
  }

  public dispose(): void {
    this.stop();
    this.yt.dispose();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
