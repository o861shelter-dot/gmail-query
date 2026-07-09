#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const RUNTIME = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'];
const VERCEL  = ['VERCEL_TOKEN','VERCEL_ORG_ID','VERCEL_PROJECT_ID'];
const CF      = ['CF_API_KEY','CF_EMAIL','CF_ACCOUNT_ID'];

function loadEnv() {
  const out = {};
  if (existsSync('.env')) for (const line of readFileSync('.env','utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g,'');
  }
  return out;
}
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
const mask = (v) => (v.length > 8 ? v.slice(0,4)+'\u2026'+v.slice(-2) : '\u2022\u2022\u2022\u2022');

async function main() {
  const env = loadEnv();
  const rl = createInterface({ input: stdin, output: stdout });
  const target = (await rl.question('Deploy target (vercel/worker/both) [both]: ')).trim() || 'both';

  const keys = [...RUNTIME];
  if (target === 'vercel' || target === 'both') keys.push(...VERCEL);
  if (target === 'worker' || target === 'both') keys.push(...CF);

  const values = {};
  for (const k of keys) {
    const def = env[k] ? ` [${mask(env[k])}]` : '';
    const ans = (await rl.question(`${k}${def}: `)).trim();
    values[k] = ans || env[k] || '';
    if (!values[k]) console.warn(`  \u26a0\ufe0f  ${k} để trống`);
  }
  rl.close();

  try { sh('gh --version'); } catch { throw new Error('Cần cài GitHub CLI (gh) và `gh auth login` trước.'); }

  console.log('\n\u2192 Đẩy secrets lên GitHub repo...');
  for (const [k, v] of Object.entries(values)) {
    if (!v) continue;
    sh(`gh secret set ${k}`, { input: v });
    console.log('  \u2713', k);
  }

  if (target === 'worker' || target === 'both') {
    try {
      console.log('\n\u2192 Tạo KV namespace TOKEN_KV...');
      const out = sh('npx wrangler kv namespace create TOKEN_KV', {
        env: { ...process.env,
          CLOUDFLARE_API_KEY: values.CF_API_KEY,
          CLOUDFLARE_EMAIL: values.CF_EMAIL,
          CLOUDFLARE_ACCOUNT_ID: values.CF_ACCOUNT_ID },
      });
      const id = (out.match(/id\s*=\s*"([^"]+)"/) || [])[1];
      if (id) { patchWrangler(id); console.log('  \u2713 KV id', id); }
      else console.log('  (không đọc được id tự động, kiểm tra output rồi điền tay vào wrangler.toml)');
    } catch (e) {
      console.log('  (bỏ qua KV, có thể đã tồn tại):', e.message.split('\n')[0]);
    }
  }
  console.log('\n\u2705 Setup xong. Push code hoặc chạy workflow trên GitHub để deploy.');
}

function patchWrangler(id) {
  if (!existsSync('wrangler.toml')) return;
  let t = readFileSync('wrangler.toml','utf8');
  if (t.includes('<filled-by-setup>')) t = t.replace('<filled-by-setup>', id);
  else if (!/binding\s*=\s*"TOKEN_KV"/.test(t)) t += `\n[[kv_namespaces]]\nbinding = "TOKEN_KV"\nid = "${id}"\n`;
  writeFileSync('wrangler.toml', t);
}

main().catch((e) => { console.error('\u274c', e.message); process.exit(1); });
