'use client';
import { useEffect, useState } from 'react';
import { WifiOff, Download, X } from 'lucide-react';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PWA() {
  const [offline, setOffline] = useState(false),
    [install, setInstall] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', prompt);
    let refreshing = false;
    const hadController =
      'serviceWorker' in navigator &&
      navigator.serviceWorker.controller !== null;
    const activateUpdate = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        activateUpdate,
      );
      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('beforeinstallprompt', prompt);
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          activateUpdate,
        );
    };
  }, []);
  return (
    <>
      {offline && (
        <div className="offline-banner" role="status">
          <WifiOff size={17} />
          Нет сети. Изменения сохраняются на устройстве; синхронизация
          продолжится после подключения.
        </div>
      )}
      {install && !offline && (
        <div className="install-banner">
          <button
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            }}
          >
            <Download size={16} />
            Установить Поток
          </button>
          <button
            aria-label="Скрыть предложение установки"
            onClick={() => setInstall(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
