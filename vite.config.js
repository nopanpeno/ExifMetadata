import { defineConfig } from 'vite';

// CSP hanya untuk build: kunci jaringan supaya janji "foto tidak keluar" ditegakkan browser.
// Satu-satunya host luar: ubin OpenStreetMap (gambar).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
};

// base relatif supaya jalan di GitHub Pages (subpath).
export default defineConfig({ base: './', plugins: [cspPlugin] });
