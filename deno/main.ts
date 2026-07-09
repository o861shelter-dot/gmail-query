// Entry cho Deno Deploy (nền tảng MỚI). Import bundle đã esbuild (dist/app.mjs).
// Cache dùng Deno KV (sống qua nhiều request, giống KV của Cloudflare).
// @ts-ignore - dist/app.mjs được tạo lúc build (npm run build), không có sẵn khi dev.
import { createApp } from '../dist/app.mjs';

const kv = await Deno.openKv();
const TOKEN_KV = {
  async get(key: string): Promise<string | null> {
    const r = await kv.get<string>(['cache', key]);
    return (r.value as string) ?? null;
  },
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    await kv.set(['cache', key], value, opts?.expirationTtl ? { expireIn: opts.expirationTtl * 1000 } : undefined);
  },
};

const RUNTIME_KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'];
function buildEnv(): Record<string, unknown> {
  const e: Record<string, unknown> = {};
  for (const k of RUNTIME_KEYS) e[k] = Deno.env.get(k);
  e.TOKEN_KV = TOKEN_KV;
  return e;
}

const app = createApp();
// deno-lint-ignore no-explicit-any
Deno.serve((req: Request) => app.fetch(req, buildEnv() as any));
