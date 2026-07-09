// Auto-detect: thử decode base64/base64url, nếu ra chuỗi "có nghĩa" thì dùng, không thì giữ raw.
export function autoDecode(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (!isBase64Like(trimmed)) return input;
  try {
    const decoded = base64ToUtf8(trimmed);
    if (decoded && decoded !== trimmed && isMostlyPrintable(decoded)) return decoded;
  } catch {
    // không decode được -> raw
  }
  return input;
}

function isBase64Like(s: string): boolean {
  // chấp nhận cả base64 và base64url; tối thiểu 8 ký tự để tránh false-positive
  return s.length >= 8 && /^[A-Za-z0-9+/=_-]+$/.test(s);
}

function base64ToUtf8(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  // fatal:true -> ném lỗi nếu không phải UTF-8 hợp lệ => coi là raw
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function isMostlyPrintable(s: string): boolean {
  let printable = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) printable++;
  }
  return printable / s.length > 0.85;
}
