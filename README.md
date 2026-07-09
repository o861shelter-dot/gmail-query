# Gmail Query App

Proxy Gmail API: query linh hoạt (param/body, raw/base64 auto-detect), lấy chỉ subject/header hoặc full/raw body, dùng refresh_token lưu trên Firebase RTDB (auth=database secret legacy), cache access_token nội bộ. **Chạy được 5 nền tảng** từ cùng 1 codebase (Hono), deploy qua **GitHub Actions**.

## Nền tảng deploy được
| Nền tảng | Free / không thẻ | Cache | Entry |
|---|---|---|---|
| Cloudflare Worker | ✅ 100K req/day | memory + KV | `src/worker.ts` |
| Vercel Edge | ✅ | memory | `api/index.ts` |
| Deno Deploy | ✅ 100K req/day | memory + **Deno KV** | `deno/main.ts` |
| Netlify Edge | ✅ | memory | `netlify/edge-functions/api.ts` |
| Supabase Edge | ✅ | memory | `supabase/functions/gmail/index.ts` |

> Các runtime họ Deno (Deno/Netlify/Supabase) import bundle `dist/app.mjs` tạo bởi `npm run build` (esbuild) để tránh vấn đề import cục bộ cần đuôi .ts. Các workflow tự build trước khi deploy.

## Tính năng
- **Query linh hoạt**: GET params hoặc POST body; mỗi giá trị auto-detect raw vs base64.
- **Chọn field**: `fields=subject,from,date` chỉ toàn header -> tự ép `format=metadata`, không fetch body. `format=full` lấy body, `format=raw` lấy MIME gốc.
- **RTDB refresh token**: đọc refresh_token từ RTDB; hết hạn/401 thì refresh; Google xoay token mới thì đẩy lại RTDB.
- **Threads**: `pick=all|first|last`.

## Endpoint
Mọi endpoint cần `x-api-key: <API_KEY>` (hoặc `?api_key=`), trừ `/health`.

| Method | Path | Mô tả |
|---|---|---|
| GET/POST | `/messages` | list + get theo `q` |
| GET | `/messages/:id` | 1 email |
| GET/POST | `/threads` | list threads, có `pick` |
| GET | `/threads/:id` | 1 thread |
| GET | `/health` | health check |

> Trên Supabase, path có tiền tố: `/functions/v1/gmail/messages` (entry tự cắt `/gmail`).

### Tham số
| Param | Ý nghĩa |
|---|---|
| `q` / `query` | Gmail search query |
| `maxResults` | 1-500, mặc định 10 |
| `pageToken` | phân trang |
| `format` | `minimal` / `metadata` / `full` / `raw` (tự suy nếu bỏ trống) |
| `fields` | `subject,from,to,date,cc,body` |
| `labelIds` / `labels` | lọc theo label |
| `pick` | (threads) `all` / `first` / `last` |

## Triển khai

### Chuẩn bị 1 lần
1. **Google Cloud Console**: OAuth Client (Web application), redirect URI `http://localhost:5555/callback`, bật Gmail API. Lấy `client_id` + `client_secret`.
2. **Firebase RTDB**: `databaseURL` + **Database secret** (legacy).
3. Token cho nền tảng bạn muốn deploy (xem `.env.example`):
   - Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - Cloudflare: `CF_API_KEY` (Global API Key), `CF_EMAIL`, `CF_ACCOUNT_ID`
   - Deno Deploy: `DENO_DEPLOY_TOKEN` (dashboard > Settings > Access Tokens)
   - Netlify: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
   - Supabase: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

### Chạy
```bash
npm install
cp .env.example .env   # điền giá trị (không bắt buộc, script sẽ hỏi nếu thiếu)
npm run oauth          # lấy refresh_token và ghi vào RTDB (1 lần)
npm run setup          # chọn target(s) -> đẩy secrets lên GitHub (+ tạo KV nếu có Cloudflare)
git push origin main   # trigger deploy, hoặc bấm Run workflow trên GitHub Actions
```
`npm run setup` nhận nhiều target: `all` hoặc ví dụ `deno,netlify,supabase`.

### Deploy tay
```bash
npm run deploy:worker     # Cloudflare
npm run deploy:vercel     # Vercel
npm run deploy:deno       # Deno Deploy
npm run deploy:netlify    # Netlify
npm run deploy:supabase   # Supabase
```

## Ví dụ
```bash
# Chỉ subject (không fetch body)
curl "https://your-app/messages?q=is:unread&fields=subject,from,date&maxResults=20" -H "x-api-key: $API_KEY"

# Full body
curl "https://your-app/messages?q=from:boss@corp.com&format=full" -H "x-api-key: $API_KEY"

# Query qua body JSON (hoặc base64, auto-detect)
curl -X POST https://your-app/messages -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' -d '{"q":"is:starred","fields":"subject,from"}'

# Threads, lấy message cuối mỗi thread
curl "https://your-app/threads?q=subject:invoice&pick=last&fields=subject,from" -H "x-api-key: $API_KEY"
```

## Lưu ý / rủi ro
- **Database secret là legacy**, Google khuyến cáo ngừng dùng. Cân nhắc chuyển service account nếu dùng lâu dài.
- **Deno Deploy Classic bị tắt 20/07/2026** — repo này nhắm nền tảng Deno Deploy **mới** (`deno deploy`). Nếu flag CLI đổi, chạy `deno deploy --help` để đối chiếu; hoặc dùng GitHub integration trong dashboard (push = auto deploy).
- **Cache in-memory** chỉ sống khi instance còn ấm. Cloudflare và Deno có thêm KV bền hơn; Vercel/Netlify/Supabase chỉ memory nên refresh thường hơn.
- **Auto-detect base64** dùng heuristic; query cực ngắn hiếm gặp có thể bị đoán nhầm, khi đó gửi kèm content-type JSON.
- Scope mặc định `gmail.readonly`, đổi qua env `GMAIL_SCOPE` khi chạy `oauth`.
