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
      className="pointer-events-none fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-lg border border-[#e2b86b]/35 bg-[#1b140f]/95 px-3 py-1.5 text-xs font-medium text-[#f5efe6]"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#e2b86b] shrink-0" />
      <span>Offline režim · Hra běží z mezipaměti</span>
    </div>
  );
};
