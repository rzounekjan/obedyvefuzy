import React from 'react';
import type { CalloutTone } from '../game/types';

interface BurstSpec {
  tx: number;
  ty: number;
  rot: number;
  delayMs: number;
  size: number;
  color: string;
  shape: 'rect' | 'diamond' | 'triangle' | 'flame';
}

const CONFETTI_SPECS: readonly BurstSpec[] = [
  { tx: -128, ty: -62, rot: -195, delayMs: 0, size: 12, color: '#ffd166', shape: 'rect' },
  { tx: -98, ty: -92, rot: 140, delayMs: 20, size: 11, color: '#06d6a0', shape: 'diamond' },
  { tx: -58, ty: -108, rot: -120, delayMs: 10, size: 13, color: '#38bdf8', shape: 'triangle' },
  { tx: -18, ty: -112, rot: 165, delayMs: 30, size: 11, color: '#ff2a85', shape: 'rect' },
  { tx: 22, ty: -110, rot: -155, delayMs: 15, size: 12, color: '#ffd166', shape: 'diamond' },
  { tx: 64, ty: -102, rot: 135, delayMs: 25, size: 13, color: '#a78bfa', shape: 'triangle' },
  { tx: 104, ty: -86, rot: -180, delayMs: 5, size: 11, color: '#06d6a0', shape: 'rect' },
  { tx: 132, ty: -54, rot: 210, delayMs: 20, size: 12, color: '#38bdf8', shape: 'diamond' },
  { tx: -140, ty: -8, rot: -160, delayMs: 15, size: 11, color: '#ff9f1c', shape: 'triangle' },
  { tx: 142, ty: -4, rot: 175, delayMs: 10, size: 11, color: '#ff2a85', shape: 'rect' },
  { tx: -124, ty: 46, rot: 145, delayMs: 25, size: 12, color: '#38bdf8', shape: 'diamond' },
  { tx: -84, ty: 78, rot: -135, delayMs: 35, size: 11, color: '#ffffff', shape: 'rect' },
  { tx: -34, ty: 86, rot: 190, delayMs: 10, size: 12, color: '#06d6a0', shape: 'triangle' },
  { tx: 36, ty: 86, rot: -185, delayMs: 20, size: 12, color: '#ffd166', shape: 'rect' },
  { tx: 86, ty: 76, rot: 150, delayMs: 30, size: 11, color: '#ffffff', shape: 'diamond' },
  { tx: 126, ty: 44, rot: -145, delayMs: 15, size: 12, color: '#a78bfa', shape: 'triangle' },
];

const FIRE_SPECS: readonly BurstSpec[] = [
  { tx: -126, ty: -58, rot: -38, delayMs: 0, size: 16, color: '#ff2a00', shape: 'flame' },
  { tx: -94, ty: -92, rot: -22, delayMs: 18, size: 18, color: '#ff6b00', shape: 'flame' },
  { tx: -52, ty: -112, rot: -10, delayMs: 8, size: 20, color: '#ffd166', shape: 'flame' },
  { tx: -12, ty: -122, rot: 4, delayMs: 24, size: 21, color: '#ff3b6b', shape: 'flame' },
  { tx: 26, ty: -118, rot: 12, delayMs: 12, size: 19, color: '#ff6b00', shape: 'flame' },
  { tx: 66, ty: -104, rot: 24, delayMs: 22, size: 18, color: '#ff9f1c', shape: 'flame' },
  { tx: 102, ty: -82, rot: 36, delayMs: 6, size: 16, color: '#ff2a00', shape: 'flame' },
  { tx: 132, ty: -48, rot: 48, delayMs: 18, size: 15, color: '#ffd166', shape: 'flame' },
  { tx: -138, ty: -4, rot: -64, delayMs: 14, size: 13, color: '#ff9f1c', shape: 'diamond' },
  { tx: 138, ty: -2, rot: 64, delayMs: 10, size: 13, color: '#ff9f1c', shape: 'diamond' },
  { tx: -116, ty: 44, rot: -115, delayMs: 22, size: 14, color: '#ff3b6b', shape: 'flame' },
  { tx: -66, ty: 72, rot: -145, delayMs: 28, size: 12, color: '#ff6b00', shape: 'diamond' },
  { tx: -18, ty: 78, rot: -170, delayMs: 12, size: 13, color: '#ffd166', shape: 'diamond' },
  { tx: 24, ty: 78, rot: 170, delayMs: 20, size: 13, color: '#ff2a00', shape: 'diamond' },
  { tx: 72, ty: 70, rot: 145, delayMs: 26, size: 12, color: '#ff6b00', shape: 'diamond' },
  { tx: 118, ty: 42, rot: 115, delayMs: 16, size: 14, color: '#ff3b6b', shape: 'flame' },
];

interface ServiceBurstEffectProps {
  tone: CalloutTone;
  burstKey: number | string;
  scale?: number;
}

/**
 * Ultra-lightweight, zero-shadow, zero-transparency flat-vector SVG explosion
 * (confetti for positive achievements, angular fire flames for negative warnings).
 * Uses pure GPU CSS transforms so Motorola Moto G14 holds a locked 60 FPS.
 */
export const ServiceBurstEffect: React.FC<ServiceBurstEffectProps> = ({
  tone,
  burstKey,
  scale = 1,
}) => {
  const specs = tone === 'positive' ? CONFETTI_SPECS : FIRE_SPECS;

  return (
    <div
      key={`${tone}-${burstKey}`}
      className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
      aria-hidden="true"
    >
      {specs.map((p, idx) => (
        <svg
          key={idx}
          width={p.size}
          height={p.size}
          viewBox="0 0 20 20"
          className="animate-burst-particle absolute -left-2.5 -top-2.5"
          style={
            {
              '--tx': `${Math.round(p.tx * scale)}px`,
              '--ty': `${Math.round(p.ty * scale)}px`,
              '--rot': `${p.rot}deg`,
              animationDelay: `${p.delayMs}ms`,
            } as React.CSSProperties
          }
        >
          {p.shape === 'rect' && (
            <rect
              x="2"
              y="5"
              width="16"
              height="10"
              rx="1.5"
              fill={p.color}
              stroke="#090814"
              strokeWidth="2"
            />
          )}
          {p.shape === 'diamond' && (
            <polygon
              points="10,1 19,10 10,19 1,10"
              fill={p.color}
              stroke="#090814"
              strokeWidth="2"
            />
          )}
          {p.shape === 'triangle' && (
            <polygon
              points="10,2 19,18 1,18"
              fill={p.color}
              stroke="#090814"
              strokeWidth="2"
            />
          )}
          {p.shape === 'flame' && (
            <>
              <polygon
                points="10,1 16,8 18,14 14,19 6,19 2,14 4,8"
                fill={p.color}
                stroke="#090814"
                strokeWidth="2"
              />
              <polygon points="10,7 13,13 10,17 7,13" fill="#ffd166" />
            </>
          )}
        </svg>
      ))}
    </div>
  );
};
