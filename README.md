# Gmail Query App

Proxy Gmail API: query linh hoạt (param/body, raw/base64 auto-detect), lấy chỉ subject/header hoặc full/raw body, dùng refresh_token lưu trên Firebase RTDB (auth=database secret legacy), cache access_token nội bộ, chạy được cả **Vercel** lẫn **Cloudflare Worker**, deploy qua **GitHub Actions**.

## Tính năng
- **Query linh hoạt**: nhận qua GET params hoặc POST body; mỗi giá trị auto-detect raw vs base64.
- **Chọn field**: `fields=subject,from,date` chỉ toàn header -> tự ép `format=metadata`, không fetch body. `format=full` lấy body, `format=raw` lấy MIME gốc.
- **RTDB refresh token**: đọc refresh_token từ RTDB; khi hết hạn/401 thì refresh; nếu Google xoay token mới thì đẩy lại RTDB.
- **Cache**: memory + KV (Cloudflare).
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
1. **Google Cloud Console**: tạo OAuth Client (Web application), redirect URI `http://localhost:5555/callback`, bật Gmail API. Lấy `client_id` + `client_secret`.
2. **Firebase RTDB**: lấy `databaseURL` + **Database secret** (legacy).
3. **Vercel**: `VERCEL_TOKEN`, `ORG_ID`, `PROJECT_ID` (chạy `vercel link`).
4. **Cloudflare**: Global API Key + email + Account ID.

### Chạy
```bash
npm install
cp .env.example .env   # điền giá trị (không bắt buộc, script sẽ hỏi nếu thiếu)
npm run oauth          # lấy refresh_token và ghi vào RTDB (1 lần)
npm run setup          # đẩy secrets lên GitHub + tạo KV namespace
git push origin main   # trigger deploy, hoặc bấm Run workflow trên GitHub Actions
```

### Deploy tay
```bash
npm run deploy:worker   # Cloudflare
npm run deploy:vercel   # Vercel
```

## Ví dụ
```bash
# Chỉ subject (không fetch body)
curl "https://your-app/messages?q=is:unread&fields=subject,from,date&maxResults=20" -H "x-api-key: $API_KEY"

# Full body
curl "https://your-app/messages?q=from:boss@corp.com&format=full" -H "x-api-key: $API_KEY"

# Query qua body JSON
curl -X POST https://your-app/messages -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' -d '{"q":"is:starred","fields":"subject,from"}'

# Threads, lấy message cuối mỗi thread
curl "https://your-app/threads?q=subject:invoice&pick=last&fields=subject,from" -H "x-api-key: $API_KEY"
```

## Lưu ý / rủi ro
- **Database secret là legacy**, Google khuyến cáo ngừng dùng. Cân nhắc chuyển service account nếu dùng lâu dài.
- **Cache in-memory** chỉ sống khi instance còn ấm. CF có thêm KV; Vercel Edge chỉ memory nên refresh thường hơn.
- **Auto-detect base64** dùng heuristic; query cực ngắn hiếm gặp có thể bị đoán nhầm, khi đó gửi kèm content-type JSON rõ ràng.
- Scope mặc định `gmail.readonly`, đổi qua env `GMAIL_SCOPE` khi chạy `oauth`.
