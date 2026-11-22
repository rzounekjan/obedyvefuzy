/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameModals } from './components/GameModals';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TitleScreen } from './components/TitleScreen';
import { TopSymbolBar } from './components/TopSymbolBar';
import { ALT_LANE_KEYS, LANE_KEYS, LEVELS } from './game/levels';
import { DEFAULT_MUSIC_TRACK_ID, getMusicTrackById, MUSIC_TRACKS } from './game/musicLibrary';
import { RhythmEngine } from './game/RhythmEngine';
import type { HudSnapshot, MusicTrackId, ProgressMap } from './game/types';

const STORAGE_KEY = 'rytmus_stolu_progress_v1';
const MUSIC_STORAGE_KEY = 'rytmus_stolu_music_v1';

function loadProgress(): ProgressMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressMap;
  } catch {
    return {};
  }
}

function saveProgress(map: ProgressMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

function loadSelectedTrack(): MusicTrackId {
  try {
    const raw = window.localStorage.getItem(MUSIC_STORAGE_KEY);
    if (raw && MUSIC_TRACKS.some((t) => t.id === raw)) {
      return raw as MusicTrackId;
    }
  } catch {
    // Ignore storage access errors
  }
  return DEFAULT_MUSIC_TRACK_ID;
}

function saveSelectedTrack(trackId: MusicTrackId): void {
  try {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, trackId);
  } catch {
    // Ignore
  }
}

function createInitialHud(trackId: MusicTrackId): HudSnapshot {
  const lvl = LEVELS[0];
  const track = getMusicTrackById(trackId);
  return {
    phase: 'title',
    levelId: lvl.id,
    musicTrackId: track.id,
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    tempoIntegrity: 100,
    progress: 0,
    bpm: track.bpm,
    currentBeat: 0,
    beatPulse: 0,
    lastJudgement: null,
    lastJudgementIsUnique: false,
    lastJudgementPoints: 0,
    judgementSeq: 0,
    lanePrompts: [
      { lane: 0, item: lvl.laneItems[0], isUnique: true, proximity: 0, inHitWindow: false, isNextRow: false, hasNote: false, flashKind: null, flashSeq: 0 },
      { lane: 1, item: lvl.laneItems[1], isUnique: false, proximity: 0, inHitWindow: false, isNextRow: false, hasNote: false, flashKind: null, flashSeq: 0 },
      { lane: 2, item: lvl.laneItems[2], isUnique: false, proximity: 0, inHitWindow: false, isNextRow: false, hasNote: false, flashKind: null, flashSeq: 0 },
      { lane: 3, item: lvl.laneItems[3], isUnique: false, proximity: 0, inHitWindow: false, isNextRow: false, hasNote: false, flashKind: null, flashSeq: 0 },
    ],
    stats: { perfect: 0, great: 0, good: 0, miss: 0, uniqueHits: 0, totalNotes: 0 },
    accuracy: 100,
    stars: 0,
  };
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RhythmEngine | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());

  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);
  const [selectedTrackId, setSelectedTrackId] = useState<MusicTrackId>(loadSelectedTrack);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(loadSelectedTrack()));
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  const [muted, setMuted] = useState<boolean>(false);

  const phaseRef = useRef(hud.phase);
  phaseRef.current = hud.phase;

  const selectedLevelRef = useRef(selectedLevelId);
  selectedLevelRef.current = selectedLevelId;

  const selectedTrackRef = useRef(selectedTrackId);
  selectedTrackRef.current = selectedTrackId;

  const isPreviewingRef = useRef(isPreviewing);
  isPreviewingRef.current = isPreviewing;

  // Mount Three.js engine once in isolated ref container so React HUD updates never tear down WebGL
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RhythmEngine(
      mount,
      (snapshot) => {
        setHud(snapshot);
      },
      (completedLevelId, snap) => {
        setProgress((prev) => {
          const existing = prev[completedLevelId];
          const updated: ProgressMap = {
            ...prev,
            [completedLevelId]: {
              bestScore: Math.max(existing?.bestScore ?? 0, snap.score),
              bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, snap.accuracy),
              maxCombo: Math.max(existing?.maxCombo ?? 0, snap.maxCombo),
              stars: Math.max(existing?.stars ?? 0, snap.stars) as 0 | 1 | 2 | 3,
            },
          };
          saveProgress(updated);
          return updated;
        });
      },
    );
    engine.setMusicTrack(selectedTrackRef.current);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectLevel = useCallback((levelId: number) => {
    setSelectedLevelId(levelId);
    engineRef.current?.audio.playUiSelect(60 + levelId);
    engineRef.current?.setShowcaseLevel(levelId);
  }, []);

  const handleSelectTrack = useCallback((trackId: MusicTrackId) => {
    setSelectedTrackId(trackId);
    saveSelectedTrack(trackId);
    const track = getMusicTrackById(trackId);
    engineRef.current?.setMusicTrack(trackId);
    engineRef.current?.audio.playUiSelect(track.rootMidi);
    if (isPreviewingRef.current) {
      engineRef.current?.startMusicPreview(trackId);
    }
  }, []);

  const handleTogglePreview = useCallback(() => {
    if (isPreviewingRef.current) {
      engineRef.current?.stopMusicPreview();
      setIsPreviewing(false);
    } else {
      engineRef.current?.startMusicPreview(selectedTrackRef.current);
      setIsPreviewing(true);
    }
  }, []);

  const handleStartLevel = useCallback((levelId: number, trackId?: MusicTrackId) => {
    const resolvedTrack = trackId ?? selectedTrackRef.current;
    setSelectedLevelId(levelId);
    setSelectedTrackId(resolvedTrack);
    setIsPreviewing(false);
    engineRef.current?.startLevel(levelId, resolvedTrack);
  }, []);

  const handleTriggerLane = useCallback((lane: 0 | 1 | 2 | 3) => {
    engineRef.current?.triggerLane(lane);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!engineRef.current) return;
    const nextMuted = engineRef.current.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setIsPreviewing(false);
    engineRef.current?.startLevel(selectedLevelRef.current, selectedTrackRef.current);
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextId = Math.min(LEVELS.length, selectedLevelRef.current + 1);
    setSelectedLevelId(nextId);
    setIsPreviewing(false);
    engineRef.current?.startLevel(nextId, selectedTrackRef.current);
  }, []);

  const handleReturnToTitle = useCallback(() => {
    setIsPreviewing(false);
    engineRef.current?.returnToTitle(selectedLevelRef.current);
  }, []);

  // Global keyboard handler (edge-triggered lane strikes, Enter/Space start, Esc pause, M mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase();

      if (heldKeysRef.current.has(key)) return;
      heldKeysRef.current.add(key);

      if (key === 'M') {
        handleToggleMute();
        return;
      }

      const phase = phaseRef.current;

      if (phase === 'title') {
        if (key === 'ENTER' || key === ' ') {
          e.preventDefault();
          handleStartLevel(selectedLevelRef.current, selectedTrackRef.current);
        } else if (key === 'ARROWRIGHT') {
          e.preventDefault();
          handleSelectLevel(Math.min(LEVELS.length, selectedLevelRef.current + 1));
        } else if (key === 'ARROWLEFT') {
          e.preventDefault();
          handleSelectLevel(Math.max(1, selectedLevelRef.current - 1));
        }
        return;
      }

      if (phase === 'playing') {
        if (key === 'ESCAPE' || key === 'P') {
          e.preventDefault();
          handlePause();
          return;
        }
        const laneIdx = LANE_KEYS.indexOf(key);
        if (laneIdx !== -1) {
          e.preventDefault();
          handleTriggerLane(laneIdx as 0 | 1 | 2 | 3);
          return;
        }
        const altIdx = ALT_LANE_KEYS.indexOf(key);
        if (altIdx !== -1) {
          e.preventDefault();
          handleTriggerLane(altIdx as 0 | 1 | 2 | 3);
        }
        return;
      }

      if (phase === 'paused') {
        if (key === 'ESCAPE' || key === 'P' || key === 'ENTER' || key === ' ') {
          e.preventDefault();
          handleResume();
        }
        return;
      }

      if (phase === 'victory' || phase === 'gameover') {
        if (key === 'ENTER' || key === ' ') {
          e.preventDefault();
          if (phase === 'victory' && selectedLevelRef.current < LEVELS.length) {
            handleNextLevel();
          } else {
            handleRestart();
          }
        } else if (key === 'ESCAPE') {
          e.preventDefault();
          handleReturnToTitle();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key.toUpperCase());
    };

    const onBlur = () => {
      heldKeysRef.current.clear();
      if (phaseRef.current === 'playing') {
        handlePause();
      } else if (isPreviewingRef.current) {
        engineRef.current?.stopMusicPreview();
        setIsPreviewing(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    handleNextLevel,
    handlePause,
    handleRestart,
    handleResume,
    handleReturnToTitle,
    handleSelectLevel,
    handleStartLevel,
    handleToggleMute,
    handleTriggerLane,
  ]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0a16]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="3D herní dráha Rytmus Stolu"
      />

      {/* Title Screen Overlay */}
      {hud.phase === 'title' && (
        <TitleScreen
          selectedLevelId={selectedLevelId}
          selectedTrackId={selectedTrackId}
          isPreviewing={isPreviewing}
          progress={progress}
          muted={muted}
          onSelectLevel={handleSelectLevel}
          onSelectTrack={handleSelectTrack}
          onTogglePreview={handleTogglePreview}
          onStartLevel={handleStartLevel}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Play Overlays: Top Symbol Bar + Low-Occlusion Perimeter HUD */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <>
          <TopSymbolBar
            lanePrompts={hud.lanePrompts}
            onTriggerLane={handleTriggerLane}
          />
          <GameHud
            hud={hud}
            muted={muted}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
          />
        </>
      )}

      {/* Pause / Victory / Game Over Modals */}
      <GameModals
        hud={hud}
        onResume={handleResume}
        onRestart={handleRestart}
        onNextLevel={handleNextLevel}
        onReturnToTitle={handleReturnToTitle}
      />

      {/* Offline PWA Status Indicator */}
      <OfflineIndicator />
    </main>
  );
}
