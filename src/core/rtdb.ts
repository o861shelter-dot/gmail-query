// Firebase Realtime Database qua REST + auth=database secret (legacy).
export class RTDB {
  private baseUrl: string;
  constructor(baseUrl: string, private secret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  private url(path: string): string {
    const p = path.replace(/^\//, '');
    return `${this.baseUrl}/${p}.json?auth=${encodeURIComponent(this.secret)}`;
  }
  async get<T = any>(path: string): Promise<T | null> {
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`RTDB get ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
  async set(path: string, value: any): Promise<void> {
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`RTDB set ${res.status}: ${await res.text()}`);
  }
}
