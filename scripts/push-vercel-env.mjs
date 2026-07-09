#!/usr/bin/env node
import { execSync } from 'node:child_process';
const KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'];
const token = process.env.VERCEL_TOKEN;
for (const k of KEYS) {
  const v = process.env[k];
  if (!v) continue;
  try { execSync(`npx vercel env rm ${k} production --yes --token=${token}`, { stdio: 'ignore' }); } catch {}
  execSync(`npx vercel env add ${k} production --token=${token}`, { input: v + '\n', stdio: ['pipe','ignore','ignore'] });
  console.log('set', k);
}
