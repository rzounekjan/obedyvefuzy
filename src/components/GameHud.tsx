import React from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { getLevelById } from '../game/levels';
import type { HitJudgement, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

const JUDGEMENT_CONFIG: Record<HitJudgement, { label: string; color: string }> = {
  perfect: { label: 'PERFEKTNÍ', color: '#ffd269' },
  great: { label: 'SKVĚLÉ', color: '#5be0a0' },
  good: { label: 'DOBRÉ', color: '#78d5ec' },
  miss: { label: 'MINUTO', color: '#f06464' },
};

/**
 * Low-occlusion perimeter HUD during active play.
 * Keeps >85% of the 3D rhythm track unobstructed, uses solid/rgba panels
 * (no backdrop-filter over WebGL), tabular numerals, and zero pulsing dots.
 */
export const GameHud: React.FC<GameHudProps> = ({ hud, muted, onToggleMute, onPause }) => {
  const level = getLevelById(hud.levelId);
  const judgeCfg = hud.lastJudgement ? JUDGEMENT_CONFIG[hud.lastJudgement] : null;
  const tempoDanger = hud.tempoIntegrity <= 30;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Mobile Compact Top Utility Row (< md) — sits cleanly above TopSymbolBar with zero overlap */}
      <div className="md:hidden fixed top-[max(8px,env(safe-area-inset-top))] left-2 right-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-[#f5efe6]/12 bg-[#16110e]/90 px-2.5 py-1.5 min-w-0">
          <div className="leading-none">
            <div className="text-[10px] text-[#b5a592]">Skóre</div>
            <div className="font-mono-tabular text-base font-bold text-[#fff7e8]">
              {hud.score.toLocaleString('cs-CZ')}
            </div>
          </div>
          <div className="h-6 w-px bg-[#f5efe6]/12" aria-hidden="true" />
          <div className="font-mono-tabular text-[11px] leading-tight text-[#c7b9a6]">
            <div>×{hud.combo}</div>
            <div className={hud.multiplier > 1 ? 'text-[#ffd269] font-bold' : 'text-[#8e8070]'}>
              {hud.multiplier}×
            </div>
          </div>
        </div>

        {/* Compact mobile tempo bar */}
        <div className="flex-1 max-w-[132px] rounded-lg border border-[#f5efe6]/12 bg-[#16110e]/90 px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] mb-1 leading-none">
            <span className={tempoDanger ? 'text-[#f06464] font-semibold' : 'text-[#b5a592]'}>
              {tempoDanger ? 'Pozor!' : 'Tempo'}
            </span>
            <span className="font-mono-tabular text-[#f5efe6] font-medium">{hud.tempoIntegrity}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#2a211b] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${hud.tempoIntegrity}%`,
                backgroundColor: tempoDanger ? '#e05252' : hud.tempoIntegrity > 65 ? '#e2b86b' : '#e8964a',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[#f5efe6]/14 bg-[#16110e]/92 text-[#f5efe6] active:bg-[#281f19] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd269]"
            aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-[#e05252]" /> : <Volume2 className="w-4 h-4 text-[#e2b86b]" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[#f5efe6]/14 bg-[#16110e]/92 text-[#f5efe6] active:bg-[#281f19] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd269]"
            aria-label="Pozastavit hru"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Top-Left Perimeter Cluster (md+): Score, Combo & Tempo Integrity */}
      <div className="hidden md:flex fixed top-4 left-4 flex-col gap-2">
        <div className="rounded-lg border border-[#f5efe6]/12 bg-[#16110e]/88 px-3.5 py-2.5 min-w-[154px]">
          <div className="text-[11px] font-medium text-[#b5a592] leading-tight">Skóre</div>
          <div className="font-mono-tabular text-2xl font-bold text-[#fff7e8] leading-tight">
            {hud.score.toLocaleString('cs-CZ')}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[#c7b9a6] font-mono-tabular">
            <span>Kombo {hud.combo}</span>
            <span aria-hidden="true" className="text-[#6b5d4e]">·</span>
            <span className={hud.multiplier > 1 ? 'text-[#ffd269] font-bold' : ''}>
              {hud.multiplier}×
            </span>
          </div>
        </div>

        {/* Tempo integrity meter */}
        <div className="rounded-lg border border-[#f5efe6]/12 bg-[#16110e]/88 px-3.5 py-2 min-w-[154px]">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={tempoDanger ? 'text-[#f06464] font-semibold' : 'text-[#b5a592]'}>
              {tempoDanger ? 'Pozor na tempo' : 'Tempo servisu'}
            </span>
            <span className="font-mono-tabular text-[#f5efe6] font-medium">{hud.tempoIntegrity}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#2a211b] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${hud.tempoIntegrity}%`,
                backgroundColor: tempoDanger ? '#e05252' : hud.tempoIntegrity > 65 ? '#e2b86b' : '#e8964a',
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Top-Right Perimeter Cluster (md+): Level info & Mute/Pause controls */}
      <div className="hidden md:flex fixed top-4 right-4 items-start gap-2">
        <div className="flex flex-col items-end rounded-lg border border-[#f5efe6]/12 bg-[#16110e]/88 px-3.5 py-2 text-right">
          <span className="text-xs font-semibold text-[#f5efe6] whitespace-nowrap">
            {String(level.id).padStart(2, '0')}. {level.name}
          </span>
          <span className="text-[11px] text-[#b5a592] font-mono-tabular whitespace-nowrap">
            {level.bpm} BPM · {hud.accuracy}% přesnost
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#f5efe6]/14 bg-[#16110e]/90 text-[#f5efe6] hover:bg-[#281f19] hover:border-[#e2b86b]/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd269]"
          aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
          title={muted ? 'Zapnout zvuk (M)' : 'Ztlumit zvuk (M)'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#e05252]" /> : <Volume2 className="w-4 h-4 text-[#e2b86b]" />}
        </button>

        <button
          type="button"
          onClick={onPause}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#f5efe6]/14 bg-[#16110e]/90 text-[#f5efe6] hover:bg-[#281f19] hover:border-[#e2b86b]/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd269]"
          aria-label="Pozastavit hru"
          title="Pauza (Esc)"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Transient Beat Hit Judgement Feedback (positioned cleanly below TopSymbolBar) */}
      {judgeCfg && hud.judgementSeq > 0 && (
        <div
          key={hud.judgementSeq}
          className="animate-judgement fixed top-[calc(max(8px,env(safe-area-inset-top))+134px)] md:top-[132px] left-1/2 flex flex-col items-center pointer-events-none"
        >
          <span
            className="font-display text-lg sm:text-2xl font-bold tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
            style={{ color: judgeCfg.color }}
          >
            {judgeCfg.label}
          </span>
          {hud.lastJudgementPoints > 0 && (
            <span className="font-mono-tabular text-xs font-bold text-[#fff5dc] drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              +{hud.lastJudgementPoints}
              {hud.lastJudgementIsUnique ? ' · Unikátní nota' : ''}
            </span>
          )}
        </div>
      )}

      {/* Subtle Bottom Progress Hairline */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-[#1f1813]">
        <div
          className="h-full bg-[#e2b86b]"
          style={{ width: `${Math.round(hud.progress * 100)}%` }}
        />
      </div>
    </div>
  );
};
