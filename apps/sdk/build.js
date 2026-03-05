import * as esbuild from 'esbuild';

const isDev = process.argv.includes('--dev');

const SDK_DEV_PORT = 3002;

const define = isDev
  ? {
      __SDK_URL__: JSON.stringify('http://localhost:3000'),
      __API_URL__: JSON.stringify('http://localhost:4000'),
    }
  : { __API_URL__: JSON.stringify('https://api.grabdy.com') };

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  define,
};

if (isDev) {
  const ctx = await esbuild.context({
    ...shared,
    outfile: 'dist/sdk.js',
  });
  await ctx.watch();

  // Serve dist/ as a static file server with CORS
  await ctx.serve({
    servedir: 'dist',
    port: SDK_DEV_PORT,
  });

  console.log(`SDK dev server running at http://localhost:${SDK_DEV_PORT}`);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build({
      ...shared,
      outfile: 'dist/sdk.js',
    }),
    esbuild.build({
      ...shared,
      outfile: 'dist/sdk.min.js',
      minify: true,
    }),
  ]);
  console.log('Build complete: dist/sdk.js, dist/sdk.min.js');
}
