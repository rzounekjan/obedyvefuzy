import { DEFAULT_MUSIC_TRACK_ID, getMusicTrackById } from './musicLibrary';
import type { HitJudgement, ItemType, LevelDefinition, MusicTrack, SfxProfileId } from './types';
import { YouTubeMusicController, type YouTubeAudioState } from './youtubePlayer';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Hybrid YouTube Audio Library + Modern Adaptive Web Audio SFX Engine.
 * - Streams any of the 10 curated rhythmic tracks from the YouTube Audio Library.
 * - Maintains a rock-solid Web Audio beat clock & seamless genre-matched synth fallback
 *   when offline or while YouTube buffers (auto-ducks to 0 when YouTube enters PLAYING).
 * - Generates modern, studio-polished hit & miss sound effects dynamically locked
 *   to the musical key, scale, and timbre of the currently playing track.
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
      this.masterGain.gain.value = this.muted ? 0 : 0.84;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.52;
      this.musicGain.connect(this.masterGain);

      // Modern punchy SFX bus with gentle dynamics compression so chords & combos never clip
      this.sfxCompressor = this.ctx.createDynamicsCompressor();
      this.sfxCompressor.threshold.value = -14;
      this.sfxCompressor.knee.value = 12;
      this.sfxCompressor.ratio.value = 5;
      this.sfxCompressor.attack.value = 0.003;
      this.sfxCompressor.release.value = 0.08;
      this.sfxCompressor.connect(this.masterGain);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.92;
      this.sfxBus.connect(this.sfxCompressor);

      // Pre-generate 0.5s white noise buffer for crisp modern snares, snaps & scratches
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
    // When YouTube Audio Library track is actively streaming audio, duck fallback synth to 0
    // so only the pure YouTube track + modern Web Audio SFX are heard.
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
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.84, this.ctx.currentTime, 0.02);
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

  /** Audition a YouTube Audio Library track live on the Title Screen */
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

    // Synchronously start YouTube Audio Library playback inside the user gesture
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

  /** Called every frame by the game loop; schedules fallback synth groove when YouTube is offline/buffering */
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

    // Skip scheduling fallback audio nodes when YouTube audio is actively streaming (saves CPU on mobile!)
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

  private scheduleFallbackGrooveStep(eighthStep: number, time: number, track: MusicTrack): void {
    if (!this.ctx || !this.musicGain) return;
    const beatInBar = Math.floor(eighthStep / 2) % 4;
    const isOffbeat = eighthStep % 2 === 1;
    const barIndex = Math.floor(eighthStep / 8);
    const chord = track.chordProgression[barIndex % track.chordProgression.length];
    const profile = track.sfxProfile;

    // Four-on-the-floor or syncopated modern kick depending on genre
    const fourOnFloor =
      profile === 'tropical' ||
      profile === 'disco' ||
      profile === 'synthwave' ||
      profile === 'darkedm';
    const kickHit = fourOnFloor
      ? !isOffbeat
      : profile === 'dnb'
        ? (!isOffbeat && beatInBar === 0) || (isOffbeat && beatInBar === 2)
        : (!isOffbeat && (beatInBar === 0 || beatInBar === 2)) ||
          (profile === 'funk' && isOffbeat && beatInBar === 1);

    if (kickHit) {
      this.playKick(time, beatInBar === 0 ? 0.56 : 0.44);
    }

    // Modern crisp clap/snare on 2 and 4
    if (!isOffbeat && (beatInBar === 1 || beatInBar === 3)) {
      this.playModernSnare(time, profile === 'lofi' ? 0.2 : 0.3);
    }

    // Hi-hat pulse
    if (isOffbeat || profile === 'dnb' || profile === 'swing' || profile === 'disco') {
      this.playHiHat(time, isOffbeat ? 0.12 : 0.06);
    }

    // Sub/synth bassline locked to track chord progression
    if (!isOffbeat || (profile === 'synthwave' && isOffbeat)) {
      const bassMidi =
        beatInBar === 0
          ? chord[0] - 12
          : beatInBar === 2
            ? chord[2] - 12
            : chord[0] - 12 + (beatInBar === 3 ? 7 : 0);
      if (!isOffbeat && (beatInBar === 0 || beatInBar === 2 || fourOnFloor)) {
        this.playBass(time, midiToFreq(bassMidi), (60 / track.bpm) * 0.68, profile);
      } else if (profile === 'synthwave' && isOffbeat) {
        this.playBass(time, midiToFreq(chord[0] - 12), (60 / track.bpm) * 0.32, profile);
      }
    }

    // Chord stab / pad
    if ((!isOffbeat && beatInBar === 0) || (isOffbeat && beatInBar === 1 && profile !== 'lofi')) {
      this.playChordPad(time, chord, (60 / track.bpm) * 1.25, beatInBar === 0 ? 0.14 : 0.08);
    }
  }

  private playKick(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.1);

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
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.042);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.048);
  }

  private playBass(time: number, freq: number, duration: number, profile: SfxProfileId): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = profile === 'synthwave' || profile === 'darkedm' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(profile === 'synthwave' || profile === 'darkedm' ? 680 : 420, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.012);
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
      gain.gain.linearRampToValueAtTime(gainAmt / midis.length, time + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + duration + 0.03);
    }
  }

  /**
   * Quantize any MIDI pitch cleanly into the currently playing music track's exact key & scale,
   * so every tap sounds like an authentic modern instrument note inside the track.
   */
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
   * Plays a modern, punchy, genre-matched hit sound locked to the currently playing music track.
   * Combines:
   *  1) Modern genre synth/instrument core (matched to activeTrack.sfxProfile)
   *  2) Crisp tactile transient click scaled to judgement (perfect/great/good)
   *  3) Subtle item harmonic character + lush radiant chord bloom on unique 2× notes
   */
  public playItemHit(item: ItemType, midiNote: number, judgement: HitJudgement, isUnique: boolean): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const lockedMidi = this.quantizeToActiveScale(midiNote);
    const baseFreq = midiToFreq(lockedMidi);
    const profile = this.activeTrack.sfxProfile;

    const judgeVol = judgement === 'perfect' ? 0.36 : judgement === 'great' ? 0.29 : 0.22;
    const vol = judgeVol * (isUnique ? 1.18 : 1.0);
    const brightness = judgement === 'perfect' ? 1.0 : judgement === 'great' ? 0.8 : 0.56;

    // 1) Crisp modern studio micro-transient (tactile hit confirmation, zero harsh click)
    this.playSfxTransient(now, profile, vol * 0.45, brightness);

    // 2) Genre-matched modern musical hit core
    switch (profile) {
      case 'tropical': {
        // Modern bright tropical marimba / kalimba pluck
        this.triggerFilteredPluck(now, baseFreq * 2, 'sine', vol * 0.85, 0.24, 3800 * brightness, 900);
        this.triggerFilteredPluck(now, baseFreq * 4, 'triangle', vol * 0.28, 0.09, 5200 * brightness, 1400);
        break;
      }
      case 'funk': {
        // Punchy FM clavinet / funky synth stab
        this.triggerFilteredPluck(now, baseFreq, 'sawtooth', vol * 0.52, 0.16, 3600 * brightness, 480, 3.2);
        this.triggerFilteredPluck(now, baseFreq * 2, 'triangle', vol * 0.55, 0.18, 2800 * brightness, 650);
        break;
      }
      case 'disco': {
        // Shimmering octave Nu-Disco bell + bright snap
        this.triggerTone(now, baseFreq * 2, 'sine', vol * 0.72, 0.26);
        this.triggerFilteredPluck(now, baseFreq * 3, 'triangle', vol * 0.38, 0.16, 4600 * brightness, 1200);
        break;
      }
      case 'swing': {
        // Modern electro-brass chord blip + crisp jazz snap
        this.triggerFilteredPluck(now, baseFreq, 'sawtooth', vol * 0.44, 0.19, 2600 * brightness, 520, 1.8);
        this.triggerFilteredPluck(now, baseFreq * 1.498, 'triangle', vol * 0.48, 0.21, 2400 * brightness, 700);
        break;
      }
      case 'synthwave': {
        // Neon analog detuned saw pluck with resonant lowpass sweep
        this.triggerFilteredPluck(now, baseFreq * 1.004, 'sawtooth', vol * 0.44, 0.24, 4200 * brightness, 420, 2.4);
        this.triggerFilteredPluck(now, baseFreq * 0.996, 'sawtooth', vol * 0.44, 0.24, 4200 * brightness, 420, 2.4);
        this.triggerTone(now, baseFreq * 2, 'sine', vol * 0.34, 0.22);
        break;
      }
      case 'lofi': {
        // Warm Rhodes electric piano tine bell
        this.triggerTone(now, baseFreq, 'sine', vol * 0.82, 0.34);
        this.triggerTone(now, baseFreq * 2, 'sine', vol * 0.32 * brightness, 0.16);
        this.triggerTone(now, baseFreq * 3, 'sine', vol * 0.12 * brightness, 0.09);
        break;
      }
      case 'latin': {
        // Crisp wooden clave + resonant modern marimba body
        this.triggerTone(now, baseFreq * 2.5, 'sine', vol * 0.45, 0.055);
        this.triggerFilteredPluck(now, baseFreq * 2, 'triangle', vol * 0.76, 0.22, 3400 * brightness, 750);
        break;
      }
      case 'futurebass': {
        // Lush wide Future Bass supersaw chord stab + crystal top
        this.triggerFilteredPluck(now, baseFreq, 'sawtooth', vol * 0.36, 0.26, 4800 * brightness, 700, 1.4);
        this.triggerFilteredPluck(now, baseFreq * 1.007, 'sawtooth', vol * 0.34, 0.26, 4800 * brightness, 700, 1.4);
        this.triggerFilteredPluck(now, baseFreq * 1.5, 'triangle', vol * 0.42, 0.28, 5200 * brightness, 1100);
        break;
      }
      case 'darkedm': {
        // Cyberpunk FM metallic pluck + tight bass transient
        this.triggerFmPluck(now, baseFreq * 2, baseFreq * 4.02, 260 * brightness, vol * 0.68, 0.2);
        this.triggerTone(now, baseFreq, 'triangle', vol * 0.42, 0.15);
        break;
      }
      case 'dnb': {
        // Liquid glossy crystal synth ping + airy shimmer
        this.triggerFmPluck(now, baseFreq * 2, baseFreq * 3, 180 * brightness, vol * 0.64, 0.22);
        this.triggerTone(now, baseFreq * 4, 'sine', vol * 0.24 * brightness, 0.14);
        break;
      }
    }

    // 3) Subtle modern tableware accent layer so each item keeps its crisp tactile identity
    if (item === 'water' || item === 'shot' || item === 'beer') {
      // Modern glassy harmonic shimmer
      this.triggerTone(now + 0.008, baseFreq * 3, 'sine', vol * 0.2 * brightness, 0.16);
    } else if (item === 'wine' || item === 'napkin') {
      // Silky upper chord air
      this.triggerTone(now + 0.018, baseFreq * 2.5, 'sine', vol * 0.22 * brightness, 0.24);
    } else if (item === 'knife' || item === 'fork' || item === 'spoon') {
      // Crisp bright metallic overtone ping
      this.triggerTone(now + 0.004, baseFreq * 4, 'sine', vol * 0.16 * brightness, 0.11);
    }

    // 4) Radiant modern harmonic chord bloom for unique 2× signature items & Perfect hits
    if (isUnique) {
      const fifthFreq = midiToFreq(lockedMidi + 7);
      const octFreq = midiToFreq(lockedMidi + 12);
      this.triggerTone(now + 0.02, fifthFreq, 'sine', vol * 0.36, 0.32);
      if (judgement === 'perfect') {
        this.triggerTone(now + 0.045, octFreq, 'sine', vol * 0.34, 0.36);
      }
    } else if (judgement === 'perfect') {
      this.triggerTone(now + 0.012, baseFreq * 2, 'sine', vol * 0.18, 0.18);
    }
  }

  /**
   * Plays a modern, musical mistake/miss cue tailored to the active track's genre and key.
   * Never uses harsh retro buzzers — uses vinyl tape-stops, muted palm-slaps, or filtered sub-cuts.
   */
  public playMiss(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const profile = this.activeTrack.sfxProfile;
    const rootLow = midiToFreq(this.activeTrack.rootMidi - 12);

    if (profile === 'synthwave' || profile === 'disco' || profile === 'lofi') {
      // Modern vinyl-brake / tape-stop pitch dip (warm filtered)
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(rootLow * 1.42, now); // subtle tritone tension
      osc.frequency.exponentialRampToValueAtTime(Math.max(48, rootLow * 0.52), now + 0.16);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(760, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.16);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.19);
      this.playMutedNoiseTick(now, 900, 0.12, 0.055);
    } else if (profile === 'funk' || profile === 'swing' || profile === 'latin') {
      // Tight damped palm-mute / percussive muted bass knock
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(rootLow * 1.18, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(52, rootLow * 0.65), now + 0.09);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      filter.Q.value = 2.0;

      g.gain.setValueAtTime(0.26, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.12);
      this.playMutedNoiseTick(now, 1450, 0.15, 0.04);
    } else {
      // Modern EDM / Future Bass / Tropical / DnB filtered sub-drop & soft low-pass cut
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(Math.min(185, rootLow * 1.35), now);
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.15);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.32, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.18);

      // Subtle dissonant muted click on top so it's unmistakable on small phone speakers
      this.triggerFilteredPluck(now, rootLow * 1.89, 'triangle', 0.15, 0.08, 620, 180);
      this.playMutedNoiseTick(now, 1100, 0.11, 0.045);
    }
  }

  private playSfxTransient(time: number, profile: SfxProfileId, gainAmt: number, brightness: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerHz =
      profile === 'lofi'
        ? 1800
        : profile === 'funk' || profile === 'swing' || profile === 'disco'
          ? 3400
          : 4400;
    filter.frequency.setValueAtTime(centerHz * (0.7 + brightness * 0.35), time);
    filter.Q.value = 1.6;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainAmt, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.026);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(time);
    src.stop(time + 0.032);
  }

  private playMutedNoiseTick(time: number, centerHz: number, gainAmt: number, duration: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerHz, time);
    filter.Q.value = 1.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainAmt, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  private triggerFilteredPluck(
    time: number,
    freq: number,
    type: OscillatorType,
    gainAmt: number,
    duration: number,
    startCutoffHz: number,
    endCutoffHz: number,
    q = 1.1,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(120, startCutoffHz), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, endCutoffHz), time + duration);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private triggerFmPluck(
    time: number,
    carrierHz: number,
    modHz: number,
    modDepth: number,
    gainAmt: number,
    duration: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(carrierHz, time);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(modHz, time);

    modGain.gain.setValueAtTime(modDepth, time);
    modGain.gain.exponentialRampToValueAtTime(1, time + duration * 0.65);

    outGain.gain.setValueAtTime(0.001, time);
    outGain.gain.linearRampToValueAtTime(gainAmt, time + 0.004);
    outGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(this.sfxBus);

    mod.start(time);
    carrier.start(time);
    mod.stop(time + duration + 0.02);
    carrier.stop(time + duration + 0.02);
  }

  public playUiSelect(pitchMidi = 67): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const locked = this.quantizeToActiveScale(pitchMidi);
    const freq = midiToFreq(locked);
    const profile = this.activeTrack.sfxProfile;

    if (profile === 'synthwave' || profile === 'futurebass' || profile === 'funk') {
      this.triggerFilteredPluck(now, freq, 'sawtooth', 0.14, 0.16, 3200, 650, 1.8);
      this.triggerTone(now, freq * 1.5, 'sine', 0.1, 0.14);
    } else if (profile === 'darkedm' || profile === 'dnb') {
      this.triggerFmPluck(now, freq * 2, freq * 3, 140, 0.16, 0.14);
    } else {
      this.triggerFilteredPluck(now, freq * 2, 'triangle', 0.16, 0.15, 3600, 900);
      this.triggerTone(now + 0.012, freq * 3, 'sine', 0.08, 0.12);
    }
  }

  public playVictoryFanfare(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const root = this.activeTrack.rootMidi;
    const sc = this.activeTrack.scaleIntervals;
    const notes = [root + sc[0], root + sc[2], root + sc[4], root + 12, root + 12 + sc[2]];
    notes.forEach((m, i) => {
      this.triggerFilteredPluck(now + i * 0.08, midiToFreq(m), 'triangle', 0.24, 0.5, 4200, 1200);
      this.triggerTone(now + i * 0.08, midiToFreq(m + 12), 'sine', 0.13, 0.48);
    });
  }

  public playGameOverCadence(): void {
    this.ensureInitialized();
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const root = this.activeTrack.rootMidi - 12;
    const notes = [root + 7, root + 5, root + 3, root];
    notes.forEach((m, i) => {
      this.triggerFilteredPluck(now + i * 0.13, midiToFreq(m), 'triangle', 0.22, 0.4, 1400, 320);
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
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.006);
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
    g.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
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
