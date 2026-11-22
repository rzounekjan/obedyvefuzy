import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';

/**
 * In-app PWA install button mounted on the Title Screen.
 * Handles native Chromium/Android/Desktop `beforeinstallprompt`, provides a Czech
 * step-by-step guide on iOS Safari, and suppresses itself in standalone mode.
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="pointer-events-auto flex h-11 items-center gap-2 rounded-lg border border-[#e2b86b]/50 bg-[#261c14] px-3.5 text-xs sm:text-sm font-semibold text-[#fff7e8] hover:bg-[#33251a] hover:border-[#ffd269] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd269]"
      >
        <Download className="w-4 h-4 text-[#e2b86b]" />
        <span>Nainstalovat aplikaci</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-lg border border-[#e2b86b]/45 bg-[#261c14] px-3.5 text-xs sm:text-sm font-semibold text-[#fff7e8] hover:bg-[#33251a] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd269]"
        >
          <Download className="w-4 h-4 text-[#e2b86b]" />
          <span>Nainstalovat na iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a08]/82 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-[#e2b86b]/30 bg-[#18120e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-xl font-bold text-[#fff7e8]"
                >
                  Přidat na plochu iPhonu / iPadu
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#f5efe6]/12 text-[#c7b9a6] hover:bg-[#281f19] hover:text-[#fff7e8] cursor-pointer"
                  aria-label="Zavřít návod"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm text-[#d6c9b8]">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#e2b86b]">1.</span>
                  <span>
                    Klepněte v liště Safari na tlačítko{' '}
                    <strong className="inline-flex items-center gap-1 text-[#fff7e8]">
                      Sdílet <Share className="w-3.5 h-3.5 inline" />
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#e2b86b]">2.</span>
                  <span>
                    Vyberte v nabídce možnost{' '}
                    <strong className="text-[#fff7e8]">Přidat na plochu</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#e2b86b]">3.</span>
                  <span>
                    Potvrďte klepnutím na <strong className="text-[#fff7e8]">Přidat</strong>. Hra pak poběží i offline jako samostatná aplikace.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#d99b38] hover:bg-[#e7ac4c] py-2.5 text-sm font-bold text-[#140f0b] transition-colors cursor-pointer"
              >
                Rozumím
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
