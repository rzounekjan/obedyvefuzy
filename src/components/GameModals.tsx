import React from 'react';
import { ArrowRight, Home, Play, RotateCcw, Star } from 'lucide-react';
import { getLevelById, ITEMS, LEVELS } from '../game/levels';
import type { HudSnapshot } from '../game/types';
import { ItemIcon } from './ItemIcons';

interface GameModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onReturnToTitle: () => void;
}

/**
 * Clean Pause, Victory, and Game Over modal dialogs.
 * Solid/rgba espresso scrim (zero backdrop-filter over WebGL) with tabular stats.
 */
export const GameModals: React.FC<GameModalsProps> = ({
  hud,
  onResume,
  onRestart,
  onNextLevel,
  onReturnToTitle,
}) => {
  if (hud.phase === 'title' || hud.phase === 'playing') return null;

  const level = getLevelById(hud.levelId);
  const uniqueDef = ITEMS[level.uniqueItem];
  const hasNextLevel = level.id < LEVELS.length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0a16] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-[#ffd166] bg-[#141229] p-6">
        {/* Header */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#38bdf8] bg-[#221d42]"
            style={{ color: uniqueDef.accentHex }}
          >
            <ItemIcon item={level.uniqueItem} className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[#94a3b8] font-mono-tabular">
              Úroveň {String(level.id).padStart(2, '0')} · {level.name}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#ffffff]">
              {hud.phase === 'paused'
                ? 'Hra pozastavena'
                : hud.phase === 'victory'
                  ? 'Servis dokončen!'
                  : 'Tempo ztraceno'}
            </h2>
          </div>
        </div>

        {/* Victory Stars */}
        {hud.phase === 'victory' && (
          <div className="mt-5 flex items-center justify-center gap-3 py-2">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-9 h-9 ${
                  s <= hud.stars ? 'text-[#ffd166] fill-[#ffd166]' : 'text-[#2d2858]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Stats Summary Grid */}
        {hud.phase !== 'paused' && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2.5 border-y-2 border-[#26224a] py-3.5 text-center">
              <div>
                <div className="text-[11px] text-[#94a3b8]">Skóre</div>
                <div className="font-mono-tabular text-lg font-bold text-[#ffffff]">
                  {hud.score.toLocaleString('cs-CZ')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#94a3b8]">Přesnost</div>
                <div className="font-mono-tabular text-lg font-bold text-[#ffd166]">
                  {hud.accuracy}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#94a3b8]">Max kombo</div>
                <div className="font-mono-tabular text-lg font-bold text-[#ffffff]">
                  {hud.maxCombo}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono-tabular">
              <div className="rounded-lg border border-[#2d2858] bg-[#1d1a3a] py-2">
                <div className="text-[#ffd166] font-bold">{hud.stats.perfect}</div>
                <div className="text-[10px] text-[#94a3b8] mt-0.5">Perfektní</div>
              </div>
              <div className="rounded-lg border border-[#2d2858] bg-[#1d1a3a] py-2">
                <div className="text-[#06d6a0] font-bold">{hud.stats.great}</div>
                <div className="text-[10px] text-[#94a3b8] mt-0.5">Skvělé</div>
              </div>
              <div className="rounded-lg border border-[#2d2858] bg-[#1d1a3a] py-2">
                <div className="text-[#38bdf8] font-bold">{hud.stats.good}</div>
                <div className="text-[10px] text-[#94a3b8] mt-0.5">Dobré</div>
              </div>
              <div className="rounded-lg border border-[#2d2858] bg-[#1d1a3a] py-2">
                <div className="text-[#ff3b6b] font-bold">{hud.stats.miss}</div>
                <div className="text-[10px] text-[#94a3b8] mt-0.5">Minuto</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {hud.phase === 'paused' && (
            <button
              type="button"
              onClick={onResume}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#ffffff] bg-[#ffd166] hover:bg-[#ffe08a] px-4 py-3 text-sm font-extrabold text-[#0b0a16] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Pokračovat</span>
            </button>
          )}

          {hud.phase === 'victory' && hasNextLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#ffffff] bg-[#ffd166] hover:bg-[#ffe08a] px-4 py-3 text-sm font-extrabold text-[#0b0a16] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Další úroveň ({LEVELS[level.id].name})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
              hud.phase === 'gameover' || (hud.phase === 'victory' && !hasNextLevel)
                ? 'border-[#ffffff] bg-[#ffd166] hover:bg-[#ffe08a] text-[#0b0a16] font-extrabold'
                : 'border-[#38bdf8] bg-[#1d1a3a] hover:bg-[#2a2457] text-[#ffffff]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Hrát znovu</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#2d2858] bg-[#141229] hover:border-[#ffd166] hover:bg-[#1d1a3a] px-4 py-2.5 text-sm font-semibold text-[#cbd5e1] hover:text-[#ffffff] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Výběr úrovně</span>
          </button>
        </div>
      </div>
    </div>
  );
};
