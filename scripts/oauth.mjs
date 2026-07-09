#!/usr/bin/env node
import http from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const SCOPE = process.env.GMAIL_SCOPE || 'https://www.googleapis.com/auth/gmail.readonly';
const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/callback`;

async function ask(rl, q, key, def = '') {
  if (process.env[key]) return process.env[key];
  const a = (await rl.question(q)).trim();
  return a || def;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const clientId     = await ask(rl, 'GOOGLE_CLIENT_ID: ', 'GOOGLE_CLIENT_ID');
  const clientSecret = await ask(rl, 'GOOGLE_CLIENT_SECRET: ', 'GOOGLE_CLIENT_SECRET');
  const rtdbUrl      = (await ask(rl, 'RTDB_URL (https://xxx.firebaseio.com): ', 'RTDB_URL')).replace(/\/$/, '');
  const rtdbSecret   = await ask(rl, 'RTDB_SECRET: ', 'RTDB_SECRET');
  const tokenPath    = await ask(rl, 'RTDB_TOKEN_PATH [/gmail/refresh_token]: ', 'RTDB_TOKEN_PATH', '/gmail/refresh_token');
  rl.close();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // ép Google trả refresh_token

  console.log('\n1) Thêm redirect URI này vào OAuth client (Google Cloud Console):');
  console.log('   ', REDIRECT);
  console.log('\n2) Mở link sau trong trình duyệt và cấp quyền:\n');
  console.log('   ', authUrl.toString(), '\n');

  const code = await waitForCode();
  console.log('-> Nhận được code, đang đổi lấy token...');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token exchange failed: ' + JSON.stringify(data));
  if (!data.refresh_token) {
    throw new Error('Không có refresh_token. Vào https://myaccount.google.com/permissions xoá quyền cũ của app rồi chạy lại (prompt=consent).');
  }

  const path = tokenPath.replace(/^\//, '');
  const put = await fetch(`${rtdbUrl}/${path}.json?auth=${encodeURIComponent(rtdbSecret)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: data.refresh_token, created_at: Date.now() }),
  });
  if (!put.ok) throw new Error('RTDB write failed: ' + (await put.text()));

  console.log(`\n\u2705 refresh_token đã lưu vào RTDB tại "${tokenPath}". Xong!`);
  process.exit(0);
}

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h2>Xong! Đóng tab này và quay lại terminal.</h2>');
      server.close();
      err ? reject(new Error(err)) : resolve(code);
    });
    server.listen(PORT, () => console.log(`3) Đang chờ callback tại ${REDIRECT} ...`));
  });
}

main().catch((e) => { console.error('\u274c', e.message); process.exit(1); });
