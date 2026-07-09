// Entry cho Netlify Edge Functions (chạy trên Deno). Cache memory-only
// (Netlify Edge không có Deno KV) => access_token có thể refresh thường hơn.
// @ts-ignore - dist/app.mjs tạo lúc build.
import { createApp } from '../../dist/app.mjs';

const RUNTIME_KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'];
function buildEnv(): Record<string, unknown> {
  const e: Record<string, unknown> = {};
  // deno-lint-ignore no-explicit-any
  for (const k of RUNTIME_KEYS) e[k] = (Deno as any).env.get(k);
  return e;
}

const app = createApp();
// deno-lint-ignore no-explicit-any
export default (req: Request) => app.fetch(req, buildEnv() as any);
export const config = { path: '/*' };
