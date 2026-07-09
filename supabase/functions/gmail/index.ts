// Entry cho Supabase Edge Functions (chạy trên Deno). Cache memory-only.
// Supabase serve function tại /functions/v1/gmail => path bên trong là /gmail/...
// nên cần cắt tiền tố /gmail trước khi đưa vào Hono.
// @ts-ignore - dist/app.mjs tạo lúc build.
import { createApp } from '../../../dist/app.mjs';

const RUNTIME_KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'];
function buildEnv(): Record<string, unknown> {
  const e: Record<string, unknown> = {};
  // deno-lint-ignore no-explicit-any
  for (const k of RUNTIME_KEYS) e[k] = (Deno as any).env.get(k);
  return e;
}

const app = createApp();
// deno-lint-ignore no-explicit-any
Deno.serve((req: Request) => {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/gmail/, '') || '/';
  const rewritten = new Request(url.toString(), req);
  return app.fetch(rewritten, buildEnv() as any);
});
