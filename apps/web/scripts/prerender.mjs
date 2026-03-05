/**
 * Pre-renders the landing page at build time.
 * Runs after `vite build` and `vite build --ssr`.
 * Injects the rendered HTML + critical CSS into dist/index.html.
 */
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');
const ssrDir = resolve(__dirname, '../dist-ssr');

// Load the SSR module
const { render } = await import(resolve(ssrDir, 'entry-server.js'));

// Render the landing page
const { html, css } = await render();

// Read the built index.html
const indexPath = resolve(distDir, 'index.html');
const template = readFileSync(indexPath, 'utf-8');

// Inject critical CSS before </head> and HTML into #root
const result = template
  .replace('</head>', `${css}\n</head>`)
  .replace('<div id="root"></div>', `<div id="root">${html}</div>`);

writeFileSync(indexPath, result);

// Clean up the throwaway SSR build
rmSync(ssrDir, { recursive: true, force: true });

console.log('Pre-rendered landing page into dist/index.html');
