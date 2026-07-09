// Cache access_token: memory (mọi runtime) + KV (Cloudflare, sống qua request).
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface TokenEntry { access_token: string; expiry: number; }
const memory = new Map<string, TokenEntry>();

export class TokenCache {
  constructor(private kv?: KVLike) {}
  async get(key: string): Promise<string | null> {
    const now = Date.now();
    const mem = memory.get(key);
    if (mem && mem.expiry > now + 30_000) return mem.access_token;
    if (this.kv) {
      const raw = await this.kv.get(key);
      if (raw) {
        const entry = JSON.parse(raw) as TokenEntry;
        if (entry.expiry > now + 30_000) { memory.set(key, entry); return entry.access_token; }
      }
    }
    return null;
  }
  async set(key: string, access_token: string, expiresInSec: number): Promise<void> {
    const entry: TokenEntry = { access_token, expiry: Date.now() + expiresInSec * 1000 };
    memory.set(key, entry);
    if (this.kv) await this.kv.put(key, JSON.stringify(entry), { expirationTtl: Math.max(60, expiresInSec) });
  }
}
