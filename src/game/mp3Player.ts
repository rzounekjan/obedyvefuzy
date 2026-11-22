/**
 * Zero-ad, instant-start local MP3 music player for FUZEDY.
 * - Plays bundled royalty-free MP3 tracks directly from public/audio/ via HTMLAudioElement.
 * - Base-path aware (works on root / and GitHub Pages /obedyvefuzy/ as well as offline PWA).
 * - Preloads the selected track on cue() so pressing Play or Preview starts instantaneously.
 */

export type LocalAudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

function resolveAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${cleanPath}`;
}

export class LocalMusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private muted = false;
  private volume = 0.78;
  private state: LocalAudioState = 'idle';
  private disposed = false;

  private onStateChange?: (state: LocalAudioState) => void;

  constructor(onStateChange?: (state: LocalAudioState) => void) {
    this.onStateChange = onStateChange;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = true;
      el.volume = this.volume;
      el.muted = this.muted;

      el.addEventListener('playing', () => {
        if (this.disposed) return;
        this.setState('playing');
      });
      el.addEventListener('waiting', () => {
        if (this.disposed) return;
        if (this.state !== 'paused' && this.state !== 'idle') {
          this.setState('loading');
        }
      });
      el.addEventListener('pause', () => {
        if (this.disposed) return;
        if (this.state === 'playing' || this.state === 'loading') {
          this.setState('paused');
        }
      });
      el.addEventListener('error', () => {
        if (this.disposed) return;
        this.setState('error');
      });

      this.audio = el;
    }
  }

  private setState(next: LocalAudioState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange?.(next);
  }

  public getState(): LocalAudioState {
    return this.state;
  }

  public isPlayingAudio(): boolean {
    return this.state === 'playing';
  }

  public cueTrack(audioFile: string): void {
    if (this.disposed || !this.audio) return;
    const url = resolveAssetUrl(audioFile);
    if (this.currentUrl === url) return;
    this.currentUrl = url;
    try {
      this.audio.src = url;
      this.audio.load();
    } catch {
      // Ignore preload errors
    }
  }

  public playTrack(audioFile: string, loop = true): void {
    if (this.disposed || !this.audio) {
      this.setState('error');
      return;
    }
    const url = resolveAssetUrl(audioFile);
    this.audio.loop = loop;
    this.audio.muted = this.muted;
    this.audio.volume = this.volume;

    try {
      this.setState('loading');
      if (this.currentUrl !== url) {
        this.currentUrl = url;
        this.audio.src = url;
      }
      this.audio.currentTime = 0;
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (!this.disposed) {
            this.setState('error');
          }
        });
      }
    } catch {
      this.setState('error');
    }
  }

  public pause(): void {
    if (!this.audio) return;
    try {
      this.audio.pause();
    } catch {
      // Ignore
    }
    if (this.state === 'playing' || this.state === 'loading') {
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.disposed || !this.audio) return;
    try {
      this.audio.muted = this.muted;
      this.audio.volume = this.volume;
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (!this.disposed) {
            this.setState('error');
          }
        });
      }
    } catch {
      this.setState('error');
    }
  }

  public stop(): void {
    if (!this.audio) return;
    try {
      this.audio.pause();
      if (this.audio.readyState > 0) {
        this.audio.currentTime = 0;
      }
    } catch {
      // Ignore
    }
    this.setState('idle');
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.audio) {
      this.audio.muted = mute;
      if (!mute) {
        this.audio.volume = this.volume;
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {
        // Ignore
      }
      this.audio = null;
    }
    this.currentUrl = null;
    this.state = 'idle';
  }
}
