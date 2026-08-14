/** Service worker registration — kept out of /login so that page stays free of client JS. */
export function AppShellScripts() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              const isLocal =
                location.hostname === 'localhost' ||
                location.hostname === '127.0.0.1';
              if (isLocal) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((r) => r.unregister());
                });
                if (window.caches) {
                  caches.keys().then((keys) =>
                    Promise.all(keys.map((k) => caches.delete(k)))
                  );
                }
                return;
              }
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `,
      }}
    />
  );
}
