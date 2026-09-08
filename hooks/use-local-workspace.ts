'use client';
import { useEffect, useState } from 'react';
import { readWorkspace } from '@/lib/local/repository';
import type { Workspace } from '@/lib/local/schema';
import { syncNow, getDevice, type SyncStatus } from '@/lib/vault/sync';
import { loadCatalog, refreshCatalog } from '@/lib/local/catalog';
export function useLocalWorkspace() {
  const [state, setState] = useState<Workspace | null>(null),
    [path, setPath] = useState('/'),
    [error, setError] = useState(''),
    [status, setStatus] = useState<SyncStatus>('local');
  useEffect(() => {
    const reload = () => {
      void Promise.all([readWorkspace(), getDevice()])
        .then(([s, d]) => {
          setState(s);
          setPath(
            d && !d.acknowledged ? '/settings/sync' : window.location.pathname,
          );
        })
        .catch((e) => setError(e.message));
    };
    void loadCatalog().catch((e) => setError(e.message)).finally(reload);
    const channel = new BroadcastChannel('potok-local');
    channel.onmessage = reload;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      void syncNow().catch(() => {});
    };
    const changed = () => {
      reload();
      clearTimeout(timer);
      timer = setTimeout(sync, 1500);
    };
    const statusChanged = (e: Event) =>
      setStatus((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener('potok:local-change', changed);
    window.addEventListener('potok:sync-status', statusChanged);
    window.addEventListener('online', sync);
    void getDevice().then((d) => {
      if (d && !d.acknowledged) setPath('/settings/sync');
      else sync();
    }).catch((e) => setError(e.message));
    // Public catalog refresh contains no financial context; packaged catalog supports offline recognition.
    void refreshCatalog();
    return () => {
      clearTimeout(timer);
      channel.close();
      window.removeEventListener('potok:local-change', changed);
      window.removeEventListener('potok:sync-status', statusChanged);
      window.removeEventListener('online', sync);
    };
  }, []);

  return { state, path, error, setError, status };
}
