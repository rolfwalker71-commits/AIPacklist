/** Service worker registration — kept out of /login so that page stays free of client JS.
 * Localhost: still register so Web Push can be tested in Chrome; skip aggressive cache wipe. */
export function AppShellScripts() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `,
      }}
    />
  );
}
