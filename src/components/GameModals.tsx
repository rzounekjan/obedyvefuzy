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
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0d0a08]/78 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#e2b86b]/28 bg-[#18120e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e2b86b]/35 bg-[#241b15]"
            style={{ color: uniqueDef.accentHex }}
          >
            <ItemIcon item={level.uniqueItem} className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[#b5a592] font-mono-tabular">
              Úroveň {String(level.id).padStart(2, '0')} · {level.name}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#fff7e8]">
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
                  s <= hud.stars ? 'text-[#ffd269] fill-[#ffd269]' : 'text-[#3a2f27]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Stats Summary Grid */}
        {hud.phase !== 'paused' && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2.5 border-y border-[#f5efe6]/10 py-3.5 text-center">
              <div>
                <div className="text-[11px] text-[#a89885]">Skóre</div>
                <div className="font-mono-tabular text-lg font-bold text-[#fff7e8]">
                  {hud.score.toLocaleString('cs-CZ')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#a89885]">Přesnost</div>
                <div className="font-mono-tabular text-lg font-bold text-[#e2b86b]">
                  {hud.accuracy}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#a89885]">Max kombo</div>
                <div className="font-mono-tabular text-lg font-bold text-[#fff7e8]">
                  {hud.maxCombo}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono-tabular">
              <div className="rounded-lg bg-[#221a15] py-2">
                <div className="text-[#ffd269] font-bold">{hud.stats.perfect}</div>
                <div className="text-[10px] text-[#a89885] mt-0.5">Perfektní</div>
              </div>
              <div className="rounded-lg bg-[#221a15] py-2">
                <div className="text-[#5be0a0] font-bold">{hud.stats.great}</div>
                <div className="text-[10px] text-[#a89885] mt-0.5">Skvělé</div>
              </div>
              <div className="rounded-lg bg-[#221a15] py-2">
                <div className="text-[#78d5ec] font-bold">{hud.stats.good}</div>
                <div className="text-[10px] text-[#a89885] mt-0.5">Dobré</div>
              </div>
              <div className="rounded-lg bg-[#221a15] py-2">
                <div className="text-[#f06464] font-bold">{hud.stats.miss}</div>
                <div className="text-[10px] text-[#a89885] mt-0.5">Minuto</div>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d99b38] hover:bg-[#e7ac4c] px-4 py-3 text-sm font-bold text-[#140f0b] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Pokračovat</span>
            </button>
          )}

          {hud.phase === 'victory' && hasNextLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d99b38] hover:bg-[#e7ac4c] px-4 py-3 text-sm font-bold text-[#140f0b] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Další úroveň ({LEVELS[level.id].name})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              hud.phase === 'gameover' || (hud.phase === 'victory' && !hasNextLevel)
                ? 'bg-[#d99b38] hover:bg-[#e7ac4c] text-[#140f0b] font-bold'
                : 'border border-[#f5efe6]/16 bg-[#241c17] hover:bg-[#2f241d] text-[#f5efe6]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Hrát znovu</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f5efe6]/12 bg-transparent hover:bg-[#241c17] px-4 py-2.5 text-sm font-medium text-[#c7b9a6] hover:text-[#fff7e8] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Výběr úrovně</span>
          </button>
        </div>
      </div>
    </div>
  );
};
