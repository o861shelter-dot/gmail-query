import { autoDecode } from './decode';

export interface QueryOptions {
  q: string;
  maxResults: number;
  pageToken?: string;
  format: 'minimal' | 'metadata' | 'full' | 'raw';
  fields?: string[];        // ví dụ: subject,from,date,body
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

const HEADER_FIELDS = new Set([
  'subject', 'from', 'to', 'cc', 'bcc', 'date', 'reply-to', 'message-id',
]);

// Gộp GET query params + POST body (JSON hoặc x-www-form-urlencoded). Mỗi value qua autoDecode.
export async function parseQuery(req: Request): Promise<QueryOptions> {
  const url = new URL(req.url);
  const params: Record<string, any> = {};

  for (const [k, v] of url.searchParams.entries()) params[k] = autoDecode(v);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const ct = req.headers.get('content-type') || '';
    const rawBody = await req.text();
    if (rawBody) {
      const decodedBody = autoDecode(rawBody); // body cũng có thể là base64
      if (ct.includes('application/json') || looksLikeJson(decodedBody)) {
        try { Object.assign(params, JSON.parse(decodedBody)); }
        catch { parseKvInto(decodedBody, params); }
      } else {
        parseKvInto(decodedBody, params);
      }
    }
  }
  return normalize(params);
}

function normalize(p: Record<string, any>): QueryOptions {
  const fields = splitList(p.fields);
  let format = p.format as string | undefined;
  // Nếu không chỉ định format và chỉ xin header (subject/from/...) -> ép metadata, KHỎI fetch body
  if (!format) {
    if (fields && fields.length && fields.every((f) => HEADER_FIELDS.has(f))) format = 'metadata';
    else format = 'full';
  }
  return {
    q: p.q || p.query || '',
    maxResults: clampInt(p.maxResults ?? p.max_results, 10, 1, 500),
    pageToken: p.pageToken || p.page_token,
    format: format as QueryOptions['format'],
    fields,
    labelIds: splitList(p.labelIds || p.labels),
    includeSpamTrash: toBool(p.includeSpamTrash),
  };
}

function splitList(v: any): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase());
  return String(v).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}
function clampInt(v: any, def: number, min: number, max: number): number {
  const n = parseInt(String(v ?? ''), 10);
  return isNaN(n) ? def : Math.max(min, Math.min(max, n));
}
function toBool(v: any): boolean { return v === true || v === 'true' || v === '1'; }
function looksLikeJson(s: string): boolean { const t = s.trim(); return t.startsWith('{') || t.startsWith('['); }
function parseKvInto(s: string, target: Record<string, any>) {
  for (const [k, v] of new URLSearchParams(s).entries()) target[k] = v;
}
