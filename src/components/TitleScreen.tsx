import React from 'react';
import { Play, Star, Volume2, VolumeX } from 'lucide-react';
import { ITEMS, LEVELS } from '../game/levels';
import type { ProgressMap } from '../game/types';
import { ItemIcon, TitleEmblem } from './ItemIcons';
import { PWAInstallButton } from './PWAInstallButton';

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
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-3.5 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] sm:p-7">
      {/* Top Row: Bespoke SVG Brand Lockup (left) + Install & Audio Controls (right) */}
      <div className="flex items-start justify-between gap-2.5 sm:gap-4">
        <div className="pointer-events-auto max-w-md rounded-xl border-2 border-[#ffd166] bg-[#141229] px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <TitleEmblem className="w-9 h-9 sm:w-11 sm:h-11 shrink-0" />
            <div>
              <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-[#ffffff] leading-none">
                Rytmus Stolu
              </h1>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-sm text-[#cbd5e1] leading-snug">
                Arkádový rytmický servis · 10 vektorových předmětů
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#ffffff] hover:border-[#ffd166] hover:bg-[#242048] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
            aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
            title={muted ? 'Zapnout zvuk (M)' : 'Ztlumit zvuk (M)'}
          >
            {muted ? <VolumeX className="w-5 h-5 text-[#ff3b6b]" /> : <Volume2 className="w-5 h-5 text-[#ffd166]" />}
          </button>
        </div>
      </div>

      {/* Bottom Dock: Selected Level Action + Compact 10-Level Selector Strip */}
      <div className="pointer-events-auto mx-auto w-full max-w-[1060px] flex flex-col gap-2 sm:gap-3">
        {/* Selected level summary & dominant Start CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl border-2 border-[#38bdf8] bg-[#141229] px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div
              className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg border-2 border-[#ffd166] bg-[#221d42]"
              style={{ color: uniqueItemDef.accentHex }}
            >
              <ItemIcon item={activeLevel.uniqueItem} className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#cbd5e1] whitespace-nowrap">
                <span className="font-mono-tabular text-[#ffd166] font-bold">
                  Úroveň {String(activeLevel.id).padStart(2, '0')} / 10
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeLevel.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{activeLevel.bpm} BPM</span>
              </div>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-[#ffffff] truncate">
                {activeLevel.name}
              </h2>
              <p className="text-[11px] sm:text-sm text-[#94a3b8] truncate">
                {activeLevel.subtitle} · {uniqueItemDef.soundCharacter}
                {levelStats ? ` · Rekord ${levelStats.bestScore.toLocaleString('cs-CZ')}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartLevel(activeLevel.id)}
            className="flex items-center justify-center gap-2.5 rounded-lg border-2 border-[#ffffff] bg-[#ffd166] hover:bg-[#ffe08a] active:scale-[0.98] px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-extrabold text-[#0b0a16] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffffff]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Hrát úroveň</span>
          </button>
        </div>

        {/* 10-Level Selector Strip (all 10 vector tableware items immediately selectable) */}
        <div className="rounded-xl border-2 border-[#2d2858] bg-[#141229] p-1.5 sm:p-2.5">
          <div className="level-scroll grid grid-cols-5 lg:grid-cols-10 gap-1 sm:gap-1.5 overflow-x-auto">
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
                  className={`flex flex-col items-center justify-between rounded-lg border-2 px-1 py-1.5 sm:px-1.5 sm:py-2 transition-colors cursor-pointer min-h-[62px] sm:min-h-[76px] focus-visible:outline-2 focus-visible:outline-[#ffd166] ${
                    isSelected
                      ? 'border-[#ffd166] bg-[#2a2457] text-[#ffffff]'
                      : 'border-[#26224a] bg-[#1a1736] text-[#94a3b8] hover:border-[#38bdf8] hover:bg-[#221d45] hover:text-[#ffffff]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between px-0.5 text-[9px] sm:text-[10px] font-mono-tabular">
                    <span className={isSelected ? 'text-[#ffd166] font-bold' : 'text-[#64748b]'}>
                      {String(lvl.id).padStart(2, '0')}
                    </span>
                    <span className="flex items-center gap-0.5" aria-label={`${stars} ze 3 hvězd`}>
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${
                            s <= stars ? 'text-[#ffd166] fill-[#ffd166]' : 'text-[#332d5e]'
                          }`}
                        />
                      ))}
                    </span>
                  </div>

                  <div className="my-0.5 sm:my-1" style={{ color: isSelected ? itemDef.accentHex : '#cbd5e1' }}>
                    <ItemIcon item={lvl.uniqueItem} className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <span className="w-full text-center text-[10px] sm:text-[11px] font-bold tracking-tight truncate whitespace-nowrap">
                    {itemDef.shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Single flat control-hint line */}
        <p className="text-center text-[11px] sm:text-xs font-medium text-[#94a3b8] tracking-wide">
          <span className="sm:hidden">Klepněte na dlaždici nebo na symboly nahoře v rytmu</span>
          <span className="hidden sm:inline">
            D · F · J · K (nebo 1–4) nebo klik na symboly nahoře · Enter Start · Esc Pauza · M Zvuk
          </span>
        </p>
      </div>
    </div>
  );
};
