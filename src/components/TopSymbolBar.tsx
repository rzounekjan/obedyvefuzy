import React from 'react';
import { ITEMS, LANE_KEYS } from '../game/levels';
import type { LanePrompt } from '../game/types';
import { ItemIcon } from './ItemIcons';

interface TopSymbolBarProps {
  lanePrompts: [LanePrompt, LanePrompt, LanePrompt, LanePrompt];
  onTriggerLane: (lane: 0 | 1 | 2 | 3) => void;
}

/**
 * Top-of-screen interactive symbol bar aligned with the 4 incoming lanes.
 * Shows the exact tableware symbols in the approaching row coming toward the player
 * with live beat-proximity meters so players can press them right on the beat
 * (by clicking/tapping directly OR pressing D / F / J / K).
 */
export const TopSymbolBar: React.FC<TopSymbolBarProps> = ({ lanePrompts, onTriggerLane }) => {
  return (
    <div className="pointer-events-none fixed top-[calc(max(8px,env(safe-area-inset-top))+50px)] md:top-3 left-1/2 -translate-x-1/2 z-20 w-[min(620px,calc(100vw-12px))] px-0.5 sm:px-2">
      <div
        className="pointer-events-auto grid grid-cols-4 gap-1.5 sm:gap-3 rounded-xl border-2 border-[#38bdf8] bg-[#141229] p-1.5 sm:p-2"
        role="group"
        aria-label="Symboly blížící se řady"
      >
        {lanePrompts.map((prompt) => {
          const itemDef = ITEMS[prompt.item];
          const keyLabel = LANE_KEYS[prompt.lane];
          const fillPct = Math.round(Math.min(1, Math.max(0, prompt.proximity)) * 100);

          let borderClass = 'border-[#2d2858]';
          let bgClass = 'bg-[#1d1a3a]';
          let iconColor = itemDef.accentHex;

          if (prompt.flashKind === 'perfect') {
            borderClass = 'border-[#ffd166]';
            bgClass = 'bg-[#4f3b0c]';
            iconColor = '#ffe9a6';
          } else if (prompt.flashKind === 'great') {
            borderClass = 'border-[#06d6a0]';
            bgClass = 'bg-[#0c3d30]';
            iconColor = '#6ef7cf';
          } else if (prompt.flashKind === 'good') {
            borderClass = 'border-[#38bdf8]';
            bgClass = 'bg-[#0f344d]';
            iconColor = '#93e1ff';
          } else if (prompt.flashKind === 'miss') {
            borderClass = 'border-[#ff3b6b]';
            bgClass = 'bg-[#4d1124]';
            iconColor = '#ff9bb3';
          } else if (prompt.inHitWindow) {
            borderClass = prompt.isUnique ? 'border-[#ffd166]' : 'border-[#ffffff]';
            bgClass = prompt.isUnique ? 'bg-[#47300a]' : 'bg-[#2c2759]';
          } else if (prompt.isNextRow) {
            borderClass = prompt.isUnique ? 'border-[#ffd166]' : 'border-[#38bdf8]';
            bgClass = 'bg-[#24204a]';
          }

          return (
            <button
              key={prompt.lane}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onTriggerLane(prompt.lane);
              }}
              style={{
                transform: prompt.inHitWindow ? 'scale(1.03)' : 'scale(1)',
              }}
              className={`relative flex flex-col items-center justify-between min-h-[68px] sm:min-h-[86px] rounded-lg border-2 px-1 sm:px-2 py-1.5 sm:py-2 transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-[#ffd166] cursor-pointer select-none overflow-hidden ${borderClass} ${bgClass}`}
              aria-label={`${itemDef.name}, klávesa ${keyLabel}`}
            >
              {/* Top row: keycap hint & unique note star */}
              <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] leading-none">
                <span className="font-mono-tabular font-bold text-[#e2e8f0] px-1 sm:px-1.5 py-0.5 rounded bg-[#0f0d20] border border-[#3a346e]">
                  {keyLabel}
                </span>
                {prompt.isUnique && prompt.hasNote ? (
                  <span
                    className="text-[#ffd166] font-bold tracking-tight text-[10px] sm:text-[11px]"
                    title="Unikátní nota úrovně (2× body)"
                  >
                    ★ 2×
                  </span>
                ) : (
                  <span className="text-[#38bdf8] font-bold text-[9px] sm:text-[10px]">
                    {prompt.isNextRow ? 'NYNÍ' : ''}
                  </span>
                )}
              </div>

              {/* Center vector tableware SVG symbol */}
              <div
                className="my-0.5 sm:my-1 flex items-center justify-center"
                style={{ color: iconColor }}
              >
                <ItemIcon item={prompt.item} className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>

              {/* Single-line Czech item label */}
              <span className="w-full text-center text-[10px] sm:text-xs font-bold tracking-tight text-[#ffffff] truncate whitespace-nowrap pb-0.5">
                {itemDef.shortName}
              </span>

              {/* Solid opaque rhythmic approach meter along bottom edge */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#0f0d20]">
                <div
                  className="h-full"
                  style={{
                    width: prompt.hasNote ? `${fillPct}%` : '0%',
                    backgroundColor: prompt.inHitWindow
                      ? '#ffd166'
                      : prompt.isUnique
                        ? '#ff9f1c'
                        : itemDef.accentHex,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
