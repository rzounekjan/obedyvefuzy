import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWA';

/**
 * Non-intrusive offline connectivity indicator (static icon, no pulsing dot).
 */
export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-lg border-2 border-[#ffd166] bg-[#141229] px-3 py-1.5 text-xs font-semibold text-[#f8fafc]"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#ffd166] shrink-0" />
      <span>Offline režim · Hra běží z mezipaměti</span>
    </div>
  );
};
