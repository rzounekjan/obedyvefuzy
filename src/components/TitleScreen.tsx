import React from 'react';
import { Play, Star, Volume2, VolumeX } from 'lucide-react';
import { ITEMS, LEVELS } from '../game/levels';
import type { ProgressMap } from '../game/types';
import { ItemIcon, TitleEmblem } from './ItemIcons';

interface TitleScreenProps {
  selectedLevelId: number;
  progress: ProgressMap;
  muted: boolean;
  onSelectLevel: (levelId: number) => void;
  onStartLevel: (levelId: number) => void;
  onToggleMute: () => void;
}

/**
 * Full-viewport Title Screen framing the live 3D rotating tableware showcase.
 * Leaves the central 3D stage unobstructed, uses clean solid/rgba espresso panels
 * (no backdrop-filter over WebGL), zero static pill badges, and a bottom 10-level dock.
 */
export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedLevelId,
  progress,
  muted,
  onSelectLevel,
  onStartLevel,
  onToggleMute,
}) => {
  const activeLevel = LEVELS.find((l) => l.id === selectedLevelId) ?? LEVELS[0];
  const uniqueItemDef = ITEMS[activeLevel.uniqueItem];
  const levelStats = progress[activeLevel.id];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-7">
      {/* Top Row: Bespoke SVG Brand Lockup (left) + Audio Toggle (right) */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto max-w-md rounded-xl border border-[#e2b86b]/20 bg-[#16110e]/88 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <TitleEmblem className="w-11 h-11 shrink-0" />
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#fff7e8] leading-none">
                Rytmus Stolu
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#c7b9a6] leading-snug">
                3D rytmický servis v taktu hudby · 10 unikátních předmětů
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border border-[#f5efe6]/15 bg-[#16110e]/88 text-[#f5efe6] hover:border-[#e2b86b]/55 hover:bg-[#241b16] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd269]"
          aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
          title={muted ? 'Zapnout zvuk (M)' : 'Ztlumit zvuk (M)'}
        >
          {muted ? <VolumeX className="w-5 h-5 text-[#e05252]" /> : <Volume2 className="w-5 h-5 text-[#e2b86b]" />}
        </button>
      </div>

      {/* Bottom Dock: Selected Level Action + Compact 10-Level Selector Strip */}
      <div className="pointer-events-auto mx-auto w-full max-w-[1060px] flex flex-col gap-3">
        {/* Selected level summary & dominant Start CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#e2b86b]/24 bg-[#16110e]/92 px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#e2b86b]/35 bg-[#241b15]"
              style={{ color: uniqueItemDef.accentHex }}
            >
              <ItemIcon item={activeLevel.uniqueItem} className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#b5a592] whitespace-nowrap">
                <span className="font-mono-tabular text-[#e2b86b] font-semibold">
                  Úroveň {String(activeLevel.id).padStart(2, '0')} / 10
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeLevel.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{activeLevel.bpm} BPM</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#fff7e8] truncate">
                {activeLevel.name}
              </h2>
              <p className="text-xs sm:text-sm text-[#b5a592] truncate">
                {activeLevel.subtitle} · {uniqueItemDef.soundCharacter}
                {levelStats ? ` · Rekord ${levelStats.bestScore.toLocaleString('cs-CZ')}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartLevel(activeLevel.id)}
            className="flex items-center justify-center gap-2.5 rounded-lg bg-[#d99b38] hover:bg-[#e7ac4c] active:scale-[0.98] px-6 py-3 text-sm sm:text-base font-bold text-[#140f0b] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#fff7e8]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Hrát úroveň</span>
          </button>
        </div>

        {/* 10-Level Selector Strip (all 10 tableware items immediately selectable) */}
        <div className="rounded-xl border border-[#f5efe6]/12 bg-[#140f0c]/92 p-2.5">
          <div className="level-scroll grid grid-cols-5 lg:grid-cols-10 gap-1.5 overflow-x-auto">
            {LEVELS.map((lvl) => {
              const isSelected = lvl.id === activeLevel.id;
              const itemDef = ITEMS[lvl.uniqueItem];
              const stats = progress[lvl.id];
              const stars = stats?.stars ?? 0;

              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onSelectLevel(lvl.id)}
                  className={`flex flex-col items-center justify-between rounded-lg border px-1.5 py-2 transition-colors cursor-pointer min-h-[76px] focus-visible:outline-2 focus-visible:outline-[#ffd269] ${
                    isSelected
                      ? 'border-[#e2b86b] bg-[#2a1f16] text-[#fff7e8]'
                      : 'border-[#f5efe6]/8 bg-[#1b1511] text-[#b5a592] hover:bg-[#241c17] hover:text-[#f5efe6]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between px-0.5 text-[10px] font-mono-tabular">
                    <span className={isSelected ? 'text-[#e2b86b] font-bold' : 'text-[#7c6f60]'}>
                      {String(lvl.id).padStart(2, '0')}
                    </span>
                    <span className="flex items-center gap-0.5" aria-label={`${stars} ze 3 hvězd`}>
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-2.5 h-2.5 ${
                            s <= stars ? 'text-[#ffd269] fill-[#ffd269]' : 'text-[#42372e]'
                          }`}
                        />
                      ))}
                    </span>
                  </div>

                  <div className="my-1" style={{ color: isSelected ? itemDef.accentHex : '#cbbca9' }}>
                    <ItemIcon item={lvl.uniqueItem} className="w-6 h-6" />
                  </div>

                  <span className="w-full text-center text-[11px] font-medium truncate whitespace-nowrap">
                    {itemDef.shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Single flat control-hint line */}
        <p className="text-center text-xs text-[#a89885] tracking-wide">
          D · F · J · K (nebo 1–4) nebo klik na symboly nahoře · Enter Start · Esc Pauza · M Zvuk
        </p>
      </div>
    </div>
  );
};
