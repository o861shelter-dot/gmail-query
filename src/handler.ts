import { Hono } from 'hono';
import { RTDB } from './core/rtdb';
import { TokenCache, KVLike } from './core/cache';
import { GoogleAuth } from './core/auth';
import { Gmail, Pick } from './core/gmail';
import { parseQuery } from './core/query';

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RTDB_URL: string;
  RTDB_SECRET: string;
  RTDB_TOKEN_PATH: string;
  API_KEY: string;
  TOKEN_KV?: KVLike; // chỉ có trên Cloudflare
}

const RUNTIME_KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','RTDB_URL','RTDB_SECRET','RTDB_TOKEN_PATH','API_KEY'] as const;

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Trên Vercel, env đến từ process.env -> inject vào c.env (CF thì đã có sẵn binding)
  app.use('*', async (c, next) => {
    if (typeof process !== 'undefined' && process.env) {
      c.env = (c.env || {}) as Env;
      for (const k of RUNTIME_KEYS) {
        if ((c.env as any)[k] == null && process.env[k] != null) (c.env as any)[k] = process.env[k];
      }
    }
    return next();
  });

  // Auth guard bằng API_KEY (bỏ qua /health)
  app.use('*', async (c, next) => {
    if (c.req.path === '/health') return next();
    const key = c.req.header('x-api-key') || new URL(c.req.url).searchParams.get('api_key');
    if (!c.env.API_KEY || key !== c.env.API_KEY) return c.json({ error: 'unauthorized' }, 401);
    return next();
  });

  const build = (env: Env) => {
    const rtdb = new RTDB(env.RTDB_URL, env.RTDB_SECRET);
    const cache = new TokenCache(env.TOKEN_KV);
    const auth = new GoogleAuth(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, rtdbTokenPath: env.RTDB_TOKEN_PATH },
      rtdb, cache,
    );
    return new Gmail(auth);
  };
  const getPick = (c: any): Pick => (new URL(c.req.url).searchParams.get('pick') || 'all') as Pick;

  app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

  app.all('/messages', async (c) => c.json(await build(c.env).listMessages(await parseQuery(c.req.raw))));
  app.get('/messages/:id', async (c) => c.json(await build(c.env).getMessage(c.req.param('id'), await parseQuery(c.req.raw))));
  app.all('/threads', async (c) => c.json(await build(c.env).listThreads(await parseQuery(c.req.raw), getPick(c))));
  app.get('/threads/:id', async (c) => c.json(await build(c.env).getThread(c.req.param('id'), await parseQuery(c.req.raw), getPick(c))));

  app.onError((err, c) => c.json({ error: err.message }, 500));
  return app;
}
