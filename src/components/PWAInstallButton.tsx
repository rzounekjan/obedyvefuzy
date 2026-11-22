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
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#38bdf8] hover:border-[#ffd166] hover:bg-[#242048] hover:text-[#ffd166] transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd166]"
        aria-label="Instalovat aplikaci"
        title="Instalovat aplikaci"
      >
        <Download className="w-5 h-5" />
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[#3a346e] bg-[#141229] text-[#38bdf8] hover:border-[#ffd166] hover:bg-[#242048] hover:text-[#ffd166] transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffd166]"
          aria-label="Instalovat aplikaci"
          title="Instalovat aplikaci"
        >
          <Download className="w-5 h-5" />
        </button>

        {showIOSGuide && (
          <div
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#0b0a16] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border-2 border-[#38bdf8] bg-[#141229] p-6">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-xl font-bold text-[#ffffff]"
                >
                  Přidat na plochu iPhonu / iPadu
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#363161] bg-[#1d1a38] text-[#cbd5e1] hover:bg-[#2a2550] hover:text-[#ffffff] cursor-pointer"
                  aria-label="Zavřít návod"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm text-[#cbd5e1]">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#ffd166]">1.</span>
                  <span>
                    Klepněte v liště Safari na tlačítko{' '}
                    <strong className="inline-flex items-center gap-1 text-[#ffffff]">
                      Sdílet <Share className="w-3.5 h-3.5 inline" />
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#ffd166]">2.</span>
                  <span>
                    Vyberte v nabídce možnost{' '}
                    <strong className="text-[#ffffff]">Přidat na plochu</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-tabular font-bold text-[#ffd166]">3.</span>
                  <span>
                    Potvrďte klepnutím na <strong className="text-[#ffffff]">Přidat</strong>. Hra pak poběží i offline jako samostatná aplikace.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg border-2 border-[#fff3c4] bg-[#ffd166] hover:bg-[#ffdf8e] py-2.5 text-sm font-extrabold text-[#0b0a16] transition-colors cursor-pointer"
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
