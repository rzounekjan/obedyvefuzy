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
    <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-20 w-[min(620px,94vw)] px-2">
      <div
        className="pointer-events-auto grid grid-cols-4 gap-2 sm:gap-3 rounded-xl border border-[#e2b86b]/25 bg-[#16110e]/92 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        role="group"
        aria-label="Symboly blížící se řady"
      >
        {lanePrompts.map((prompt) => {
          const itemDef = ITEMS[prompt.item];
          const keyLabel = LANE_KEYS[prompt.lane];
          const fillPct = Math.round(Math.min(1, Math.max(0, prompt.proximity)) * 100);

          let borderClass = 'border-[#f5efe6]/12';
          let bgClass = 'bg-[#211914]';
          let iconColor = itemDef.accentHex;

          if (prompt.flashKind === 'perfect') {
            borderClass = 'border-[#ffd269]';
            bgClass = 'bg-[#423012]';
            iconColor = '#ffe49e';
          } else if (prompt.flashKind === 'great') {
            borderClass = 'border-[#4ac98c]';
            bgClass = 'bg-[#153425]';
            iconColor = '#84e8b7';
          } else if (prompt.flashKind === 'good') {
            borderClass = 'border-[#67c8e0]';
            bgClass = 'bg-[#152d36]';
            iconColor = '#9ee4f5';
          } else if (prompt.flashKind === 'miss') {
            borderClass = 'border-[#e05252]';
            bgClass = 'bg-[#3b1515]';
            iconColor = '#ff8a8a';
          } else if (prompt.inHitWindow) {
            borderClass = prompt.isUnique ? 'border-[#ffd269]' : 'border-[#f5efe6]/85';
            bgClass = prompt.isUnique ? 'bg-[#3b2910]' : 'bg-[#2e231c]';
          } else if (prompt.isNextRow) {
            borderClass = prompt.isUnique ? 'border-[#e2b86b]/75' : 'border-[#e2b86b]/45';
            bgClass = 'bg-[#261d17]';
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
              className={`relative flex flex-col items-center justify-between min-h-[78px] sm:min-h-[86px] rounded-lg border px-2 py-2 transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-[#ffd269] cursor-pointer select-none overflow-hidden ${borderClass} ${bgClass}`}
              aria-label={`${itemDef.name}, klávesa ${keyLabel}`}
            >
              {/* Top row: keycap hint & unique note star */}
              <div className="w-full flex items-center justify-between text-[11px] leading-none">
                <span className="font-mono-tabular font-bold text-[#c7b9a6] px-1.5 py-0.5 rounded bg-[#120e0b]/80 border border-[#f5efe6]/12">
                  {keyLabel}
                </span>
                {prompt.isUnique && prompt.hasNote ? (
                  <span
                    className="text-[#ffd269] font-semibold tracking-tight text-[11px]"
                    title="Unikátní nota úrovně (2× body)"
                  >
                    ★ 2×
                  </span>
                ) : (
                  <span className="text-[#8a7c6c] text-[10px]">
                    {prompt.isNextRow ? 'NYNÍ' : ''}
                  </span>
                )}
              </div>

              {/* Center tableware SVG symbol */}
              <div
                className="my-1 flex items-center justify-center"
                style={{ color: iconColor }}
              >
                <ItemIcon item={prompt.item} className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              {/* Single-line Czech item label */}
              <span className="w-full text-center text-[11px] sm:text-xs font-medium text-[#f5efe6]/90 truncate whitespace-nowrap">
                {itemDef.shortName}
              </span>

              {/* Live rhythmic approach meter along bottom edge */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#120e0b]/90">
                <div
                  className="h-full transition-opacity duration-75"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: prompt.inHitWindow
                      ? '#ffd269'
                      : prompt.isUnique
                        ? '#e2b86b'
                        : itemDef.accentHex,
                    opacity: prompt.hasNote ? 1 : 0.15,
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
