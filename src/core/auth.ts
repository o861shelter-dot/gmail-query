import { RTDB } from './rtdb';
import { TokenCache } from './cache';

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  rtdbTokenPath: string;
}

export class GoogleAuth {
  private cacheKey = 'gmail:access_token';
  constructor(private cfg: AuthConfig, private rtdb: RTDB, private cache: TokenCache) {}

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const cached = await this.cache.get(this.cacheKey);
      if (cached) return cached;
    }
    return this.refresh();
  }

  async refresh(): Promise<string> {
    const stored = await this.rtdb.get<{ refresh_token: string } | string>(this.cfg.rtdbTokenPath);
    const refreshToken = typeof stored === 'string' ? stored : stored?.refresh_token;
    if (!refreshToken) throw new Error('No refresh_token in RTDB at ' + this.cfg.rtdbTokenPath);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Token refresh ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };

    await this.cache.set(this.cacheKey, data.access_token, data.expires_in);

    // Google có thể xoay refresh_token -> đẩy lại RTDB
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      const payload = typeof stored === 'string'
        ? data.refresh_token
        : { ...(stored || {}), refresh_token: data.refresh_token, updated_at: Date.now() };
      await this.rtdb.set(this.cfg.rtdbTokenPath, payload);
    }
    return data.access_token;
  }
}
