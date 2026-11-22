/**
 * Lightweight, fault-tolerant YouTube IFrame Player API controller for background music.
 * - Loads https://www.youtube.com/iframe_api lazily without blocking offline PWA play.
 * - Keeps an off-screen 1x1 hidden player so gameplay stays 100% pure 3D arcade canvas.
 * - Notifies listeners when YouTube audio actually enters PLAYING state so the Web Audio
 *   fallback groove seamlessly crossfades out, or stays active if offline/restricted.
 */

interface YTPlayer {
  loadVideoById(args: { videoId: string; startSeconds?: number }): void;
  cueVideoById(args: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      height: string | number;
      width: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiScriptPromise: Promise<YTNamespace | null> | null = null;

function loadYouTubeIframeAPI(): Promise<YTNamespace | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve(window.YT);
  }
  if (apiScriptPromise) return apiScriptPromise;

  apiScriptPromise = new Promise((resolve) => {
    // Offline fast-exit
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (ns: YTNamespace | null) => {
      if (settled) return;
      settled = true;
      resolve(ns);
    };

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      finish(window.YT ?? null);
    };

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => finish(null);
      document.head.appendChild(script);
    }

    // Timeout safety so offline/blocked networks never hang
    window.setTimeout(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        finish(window.YT);
      } else {
        finish(null);
      }
    }, 6500);
  });

  return apiScriptPromise;
}

export type YouTubeAudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export class YouTubeMusicController {
  private hostDiv: HTMLDivElement | null = null;
  private player: YTPlayer | null = null;
  private ready = false;
  private disposed = false;

  private muted = false;
  private volume = 72;
  private currentVideoId: string | null = null;
  private pendingPlay: { videoId: string; startSeconds: number; loop: boolean } | null = null;
  private pendingCue: { videoId: string; startSeconds: number } | null = null;
  private loopCurrent = true;
  private state: YouTubeAudioState = 'idle';

  private onStateChange?: (state: YouTubeAudioState) => void;

  constructor(onStateChange?: (state: YouTubeAudioState) => void) {
    this.onStateChange = onStateChange;
    this.initAsync();
  }

  private setState(next: YouTubeAudioState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange?.(next);
  }

  public getState(): YouTubeAudioState {
    return this.state;
  }

  public isPlayingAudio(): boolean {
    return this.state === 'playing';
  }

  private initAsync(): void {
    if (typeof document === 'undefined') return;

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.style.top = '-9999px';
    host.style.width = '200px';
    host.style.height = '200px';
    host.style.pointerEvents = 'none';
    host.style.overflow = 'hidden';

    const inner = document.createElement('div');
    host.appendChild(inner);
    document.body.appendChild(host);
    this.hostDiv = host;

    void loadYouTubeIframeAPI().then((YT) => {
      if (this.disposed || !YT || !this.hostDiv) {
        this.setState('error');
        return;
      }

      const origin =
        typeof window !== 'undefined' && window.location.origin.startsWith('http')
          ? window.location.origin
          : undefined;

      const playerVars: Record<string, string | number> = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
      };
      if (origin) playerVars.origin = origin;

      this.player = new YT.Player(inner, {
        width: 200,
        height: 200,
        playerVars,
        events: {
          onReady: () => {
            if (this.disposed || !this.player) return;
            this.ready = true;
            this.player.setVolume(this.volume);
            if (this.muted) this.player.mute();
            else this.player.unMute();

            if (this.pendingPlay) {
              const req = this.pendingPlay;
              this.pendingPlay = null;
              this.playTrack(req.videoId, req.startSeconds, req.loop);
            } else if (this.pendingCue) {
              const req = this.pendingCue;
              this.pendingCue = null;
              this.cueTrack(req.videoId, req.startSeconds);
            }
          },
          onStateChange: (e) => {
            if (this.disposed) return;
            const PS = YT.PlayerState;
            if (e.data === PS.PLAYING) {
              this.setState('playing');
            } else if (e.data === PS.BUFFERING) {
              if (this.state !== 'playing') this.setState('loading');
            } else if (e.data === PS.PAUSED) {
              this.setState('paused');
            } else if (e.data === PS.ENDED) {
              if (this.loopCurrent && this.currentVideoId && this.player) {
                this.player.loadVideoById({ videoId: this.currentVideoId, startSeconds: 0 });
              } else {
                this.setState('idle');
              }
            }
          },
          onError: () => {
            if (this.disposed) return;
            this.setState('error');
          },
        },
      });
    });
  }

  public cueTrack(videoId: string, startSeconds = 0): void {
    this.currentVideoId = videoId;
    if (!this.ready || !this.player) {
      this.pendingCue = { videoId, startSeconds };
      return;
    }
    try {
      this.player.cueVideoById({ videoId, startSeconds });
    } catch {
      // Ignore cue error when offline
    }
  }

  public playTrack(videoId: string, startSeconds = 0, loop = true): void {
    this.currentVideoId = videoId;
    this.loopCurrent = loop;
    this.pendingCue = null;

    if (!this.ready || !this.player) {
      this.pendingPlay = { videoId, startSeconds, loop };
      this.setState('loading');
      return;
    }

    try {
      this.setState('loading');
      if (this.muted) this.player.mute();
      else {
        this.player.unMute();
        this.player.setVolume(this.volume);
      }
      this.player.loadVideoById({ videoId, startSeconds });
      this.player.playVideo();
    } catch {
      this.setState('error');
    }
  }

  public pause(): void {
    this.pendingPlay = null;
    if (this.ready && this.player) {
      try {
        this.player.pauseVideo();
      } catch {
        // Ignore
      }
    }
    if (this.state === 'playing' || this.state === 'loading') {
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.ready && this.player) {
      try {
        if (!this.muted) {
          this.player.unMute();
          this.player.setVolume(this.volume);
        }
        this.player.playVideo();
      } catch {
        this.setState('error');
      }
    }
  }

  public stop(): void {
    this.pendingPlay = null;
    if (this.ready && this.player) {
      try {
        this.player.stopVideo();
      } catch {
        // Ignore
      }
    }
    this.setState('idle');
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.ready && this.player) {
      try {
        if (mute) this.player.mute();
        else {
          this.player.unMute();
          this.player.setVolume(this.volume);
        }
      } catch {
        // Ignore
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.pendingPlay = null;
    this.pendingCue = null;
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        // Ignore
      }
      this.player = null;
    }
    if (this.hostDiv && this.hostDiv.parentNode) {
      this.hostDiv.parentNode.removeChild(this.hostDiv);
    }
    this.hostDiv = null;
  }
}
