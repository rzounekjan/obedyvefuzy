import React from 'react';
import {
  AlertTriangle,
  Crown,
  Flame,
  Pause,
  Sparkles,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getLevelById } from '../game/levels';
import { getMusicTrackById } from '../game/musicLibrary';
import type { HitJudgement, HudSnapshot, ServiceCalloutKind } from '../game/types';
import { ServiceBurstEffect } from './ServiceBurstEffect';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

const JUDGEMENT_CONFIG: Record<HitJudgement, { label: string; color: string; bg: string }> = {
  perfect: { label: 'PERFEKTNÍ', color: '#0b0a16', bg: '#ffd166' },
  great: { label: 'SKVĚLÉ', color: '#0b0a16', bg: '#06d6a0' },
  good: { label: 'DOBRÉ', color: '#0b0a16', bg: '#38bdf8' },
  miss: { label: 'MINUTO', color: '#ffffff', bg: '#ff3b6b' },
};

const CALLOUT_STYLE: Record<
  ServiceCalloutKind,
  { bg: string; border: string; text: string; iconColor: string }
> = {
  'super-service': {
    bg: '#0d2b26',
    border: '#06d6a0',
    text: '#ffffff',
    iconColor: '#06d6a0',
  },
  best: {
    bg: '#2c2008',
    border: '#ffd166',
    text: '#ffd166',
    iconColor: '#ffd166',
  },
  'bad-service': {
    bg: '#2b0d17',
    border: '#ff3b6b',
    text: '#ffffff',
    iconColor: '#ff6b00',
  },
  manager: {
    bg: '#2b0d0a',
    border: '#ff6b00',
    text: '#ffd166',
    iconColor: '#ff3b6b',
  },
  'fired-warning': {
    bg: '#380912',
    border: '#ff2a00',
    text: '#ffffff',
    iconColor: '#ffd166',
  },
};

function renderCalloutIcon(kind: ServiceCalloutKind, color: string): React.ReactNode {
  const cls = 'w-5 h-5 sm:w-6 sm:h-6 shrink-0';
  switch (kind) {
    case 'super-service':
      return <Sparkles className={cls} style={{ color }} />;
    case 'best':
      return <Crown className={cls} style={{ color }} />;
    case 'bad-service':
      return <AlertTriangle className={cls} style={{ color }} />;
    case 'manager':
      return <UserX className={cls} style={{ color }} />;
    case 'fired-warning':
      return <Flame className={cls} style={{ color }} />;
  }
}

/**
 * Crisp opaque flat-vector arcade perimeter HUD (zero shadows, zero transparency).
 */
export const GameHud: React.FC<GameHudProps> = ({ hud, muted, onToggleMute, onPause }) => {
  const level = getLevelById(hud.levelId);
  const track = getMusicTrackById(hud.musicTrackId);
  const judgeCfg = hud.lastJudgement ? JUDGEMENT_CONFIG[hud.lastJudgement] : null;
  const tempoDanger = hud.tempoIntegrity <= 30;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Mobile Compact Top Utility Row (< md) — solid opaque arcade bar above TopSymbolBar */}
      <div className="md:hidden fixed top-[max(8px,env(safe-area-inset-top))] left-2 right-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border-2 border-[#38bdf8] bg-[#141229] px-2.5 py-1.5 min-w-0">
          <div className="leading-none">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Skóre</div>
            <div className="font-mono-tabular text-base font-bold text-[#ffffff]">
              {hud.score.toLocaleString('cs-CZ')}
            </div>
          </div>
          <div className="h-6 w-0.5 bg-[#2d2858]" aria-hidden="true" />
          <div className="font-mono-tabular text-[11px] leading-tight text-[#cbd5e1]">
            <div>×{hud.combo}</div>
            <div className={hud.multiplier > 1 ? 'text-[#ffd166] font-bold' : 'text-[#94a3b8]'}>
              {hud.multiplier}×
            </div>
          </div>
        </div>

        {/* Compact mobile tempo bar */}
        <div className="flex-1 max-w-[132px] rounded-lg border-2 border-[#2d2858] bg-[#141229] px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] mb-1 leading-none">
            <span className={tempoDanger ? 'text-[#ff3b6b] font-bold' : 'text-[#cbd5e1] font-semibold'}>
              {tempoDanger ? 'POZOR!' : 'TEMPO'}
            </span>
            <span className="font-mono-tabular text-[#ffffff] font-bold">{hud.tempoIntegrity}%</span>
          </div>
          <div className="h-2 w-full rounded bg-[#26224a] overflow-hidden">
            <div
              className="h-full transition-[width] duration-150"
              style={{
                width: `${hud.tempoIntegrity}%`,
                backgroundColor: tempoDanger ? '#ff3b6b' : hud.tempoIntegrity > 65 ? '#06d6a0' : '#ff9f1c',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#ffffff] active:bg-[#242048] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
            aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-[#ff3b6b]" /> : <Volume2 className="w-4 h-4 text-[#ffd166]" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#ffffff] active:bg-[#242048] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
            aria-label="Pozastavit hru"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Top-Left Perimeter Cluster (md+): Score, Combo & Tempo Integrity */}
      <div className="hidden md:flex fixed top-4 left-4 flex-col gap-2">
        <div className="rounded-lg border-2 border-[#38bdf8] bg-[#141229] px-3.5 py-2.5 min-w-[160px]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] leading-tight">Skóre</div>
          <div className="font-mono-tabular text-2xl font-bold text-[#ffffff] leading-tight">
            {hud.score.toLocaleString('cs-CZ')}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[#cbd5e1] font-mono-tabular">
            <span>Kombo {hud.combo}</span>
            <span aria-hidden="true" className="text-[#64748b]">·</span>
            <span className={hud.multiplier > 1 ? 'text-[#ffd166] font-bold' : ''}>
              {hud.multiplier}×
            </span>
          </div>
        </div>

        {/* Tempo integrity meter */}
        <div className="rounded-lg border-2 border-[#2d2858] bg-[#141229] px-3.5 py-2 min-w-[160px]">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={tempoDanger ? 'text-[#ff3b6b] font-bold' : 'text-[#cbd5e1] font-semibold'}>
              {tempoDanger ? 'Pozor na tempo!' : 'Tempo servisu'}
            </span>
            <span className="font-mono-tabular text-[#ffffff] font-bold">{hud.tempoIntegrity}%</span>
          </div>
          <div className="h-2 w-full rounded bg-[#26224a] overflow-hidden">
            <div
              className="h-full transition-[width] duration-150"
              style={{
                width: `${hud.tempoIntegrity}%`,
                backgroundColor: tempoDanger ? '#ff3b6b' : hud.tempoIntegrity > 65 ? '#06d6a0' : '#ff9f1c',
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Top-Right Perimeter Cluster (md+): Level info & Mute/Pause controls */}
      <div className="hidden md:flex fixed top-4 right-4 items-start gap-2">
        <div className="flex flex-col items-end rounded-lg border-2 border-[#2d2858] bg-[#141229] px-3.5 py-2 text-right">
          <span className="text-xs font-bold text-[#ffffff] whitespace-nowrap">
            {String(level.id).padStart(2, '0')}. {level.name}
          </span>
          <span className="text-[11px] text-[#94a3b8] font-mono-tabular whitespace-nowrap">
            {track.genre} · {hud.bpm} BPM · {hud.accuracy}% přesnost
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#ffffff] hover:bg-[#242048] hover:border-[#ffd166] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
          aria-label={muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
          title={muted ? 'Zapnout zvuk (M)' : 'Ztlumit zvuk (M)'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#ff3b6b]" /> : <Volume2 className="w-4 h-4 text-[#ffd166]" />}
        </button>

        <button
          type="button"
          onClick={onPause}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#ffffff] hover:bg-[#242048] hover:border-[#ffd166] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#ffd166]"
          aria-label="Pozastavit hru"
          title="Pauza (Esc)"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Solid Opaque Arcade Beat Hit Judgement Feedback */}
      {judgeCfg && hud.judgementSeq > 0 && (
        <div
          key={hud.judgementSeq}
          className="animate-judgement fixed top-[calc(max(8px,env(safe-area-inset-top))+58px)] md:top-5 left-1/2 flex flex-col items-center pointer-events-none"
        >
          <span
            className="rounded-md border-2 border-[#090814] px-3 py-0.5 font-mono-tabular text-sm sm:text-base font-extrabold tracking-wider"
            style={{ backgroundColor: judgeCfg.bg, color: judgeCfg.color }}
          >
            {judgeCfg.label}
          </span>
          {hud.lastJudgementPoints > 0 && (
            <span className="mt-1 rounded bg-[#141229] border border-[#ffd166] px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-[#ffd166]">
              +{hud.lastJudgementPoints}
              {hud.lastJudgementIsUnique ? ' · 2×' : ''}
            </span>
          )}
        </div>
      )}

      {/* Exploding Service Streak & Tempo Warning Indicator (Confetti / Fire) */}
      {hud.serviceCallout && (
        <div
          key={hud.serviceCallout.seq}
          className={`fixed top-[calc(max(8px,env(safe-area-inset-top))+118px)] md:top-[78px] left-1/2 z-20 pointer-events-none ${
            hud.serviceCallout.tone === 'positive'
              ? 'animate-callout-positive'
              : 'animate-callout-negative'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <ServiceBurstEffect
              tone={hud.serviceCallout.tone}
              burstKey={hud.serviceCallout.seq}
              scale={1}
            />
            <div
              className="relative z-10 flex items-center gap-2 rounded-xl border-2 px-4 py-2 whitespace-nowrap"
              style={{
                backgroundColor: CALLOUT_STYLE[hud.serviceCallout.kind].bg,
                borderColor: CALLOUT_STYLE[hud.serviceCallout.kind].border,
                color: CALLOUT_STYLE[hud.serviceCallout.kind].text,
              }}
            >
              {renderCalloutIcon(
                hud.serviceCallout.kind,
                CALLOUT_STYLE[hud.serviceCallout.kind].iconColor,
              )}
              <span className="font-display text-sm sm:text-lg font-extrabold tracking-wide uppercase">
                {hud.serviceCallout.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Solid Bottom Progress Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1.5 bg-[#1b1738]">
        <div
          className="h-full bg-[#ffd166]"
          style={{ width: `${Math.round(hud.progress * 100)}%` }}
        />
      </div>
    </div>
  );
};
