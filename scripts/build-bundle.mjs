#!/usr/bin/env node
// Bundle toàn bộ core (Hono + src/*) thành 1 file ESM duy nhất, không còn import cục bộ.
// Các runtime họ Deno (Deno Deploy / Netlify Edge / Supabase) import file này => tránh
// vấn đề Deno bắt buộc phải có đuôi .ts khi import cục bộ.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  outfile: 'dist/app.mjs',
  mainFields: ['module', 'main'],
  conditions: ['worker', 'browser', 'import', 'default'],
  legalComments: 'none',
});
console.log('\u2705 built dist/app.mjs');
