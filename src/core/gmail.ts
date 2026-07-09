import { GoogleAuth } from './auth';
import { QueryOptions } from './query';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
export type Pick = 'all' | 'first' | 'last';

export class Gmail {
  constructor(private auth: GoogleAuth) {}

  private async call(path: string, params?: Record<string, string | string[]>): Promise<any> {
    const doFetch = async (token: string) => {
      const url = new URL(GMAIL + path);
      if (params) for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
        else if (v != null) url.searchParams.set(k, v);
      }
      return fetch(url.toString(), { headers: { authorization: `Bearer ${token}` } });
    };
    let token = await this.auth.getAccessToken();
    let res = await doFetch(token);
    if (res.status === 401) { token = await this.auth.getAccessToken(true); res = await doFetch(token); }
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async listMessages(opts: QueryOptions) {
    const params: Record<string, string | string[]> = { maxResults: String(opts.maxResults) };
    if (opts.q) params.q = opts.q;
    if (opts.pageToken) params.pageToken = opts.pageToken;
    if (opts.labelIds) params.labelIds = opts.labelIds;
    if (opts.includeSpamTrash) params.includeSpamTrash = 'true';

    const list = await this.call('/messages', params);
    const ids: string[] = (list.messages || []).map((m: any) => m.id);
    const messages = await Promise.all(ids.map((id) => this.getMessage(id, opts)));
    return { messages, nextPageToken: list.nextPageToken, resultSizeEstimate: list.resultSizeEstimate };
  }

  async getMessage(id: string, opts: QueryOptions) {
    const params: Record<string, string | string[]> = { format: opts.format };
    if (opts.format === 'metadata' && opts.fields) {
      params.metadataHeaders = opts.fields.filter((f) => f !== 'body').map(headerName);
    }
    return shapeMessage(await this.call(`/messages/${id}`, params), opts);
  }

  async listThreads(opts: QueryOptions, pick: Pick) {
    const params: Record<string, string | string[]> = { maxResults: String(opts.maxResults) };
    if (opts.q) params.q = opts.q;
    if (opts.pageToken) params.pageToken = opts.pageToken;
    const list = await this.call('/threads', params);
    const ids: string[] = (list.threads || []).map((t: any) => t.id);
    const threads = await Promise.all(ids.map((id) => this.getThread(id, opts, pick)));
    return { threads, nextPageToken: list.nextPageToken };
  }

  async getThread(id: string, opts: QueryOptions, pick: Pick) {
    const params: Record<string, string | string[]> = { format: opts.format };
    if (opts.format === 'metadata' && opts.fields) {
      params.metadataHeaders = opts.fields.filter((f) => f !== 'body').map(headerName);
    }
    const thread = await this.call(`/threads/${id}`, params);
    let msgs = thread.messages || [];
    if (pick === 'first') msgs = msgs.slice(0, 1);
    else if (pick === 'last') msgs = msgs.slice(-1);
    return { id: thread.id, messages: msgs.map((m: any) => shapeMessage(m, opts)) };
  }
}

function headerName(f: string): string {
  const map: Record<string, string> = { 'message-id': 'Message-ID', 'reply-to': 'Reply-To' };
  return map[f] || f.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('-');
}

function shapeMessage(msg: any, opts: QueryOptions) {
  if (opts.format === 'minimal') {
    return { id: msg.id, threadId: msg.threadId, labelIds: msg.labelIds, snippet: msg.snippet };
  }
  const headers = indexHeaders(msg.payload?.headers || []);
  const want = opts.fields;
  const wantHeader = (h: string) => !want || want.includes(h);
  const out: any = { id: msg.id, threadId: msg.threadId, labelIds: msg.labelIds, snippet: msg.snippet };

  if (wantHeader('subject')) out.subject = headers['subject'];
  if (wantHeader('from')) out.from = headers['from'];
  if (wantHeader('to')) out.to = headers['to'];
  if (wantHeader('date')) out.date = headers['date'];
  if (want?.includes('cc')) out.cc = headers['cc'];

  if (opts.format === 'raw') out.raw = msg.raw;
  else if (opts.format === 'full' && (!want || want.includes('body'))) out.body = extractBody(msg.payload);
  return out;
}

function indexHeaders(headers: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) out[h.name.toLowerCase()] = h.value;
  return out;
}

function extractBody(payload: any): { text?: string; html?: string } {
  const result: { text?: string; html?: string } = {};
  const walk = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || '';
    if (mime === 'text/plain' && part.body?.data) result.text = decodeB64Url(part.body.data);
    else if (mime === 'text/html' && part.body?.data) result.html = decodeB64Url(part.body.data);
    if (part.parts) part.parts.forEach(walk);
  };
  walk(payload);
  return result;
}

function decodeB64Url(data: string): string {
  let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
