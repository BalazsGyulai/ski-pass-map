export interface KofiWebhookPayload {
  verification_token?: string;
  kofi_transaction_id?: string;
  message_id?: string;
  timestamp?: string;
  type?: string;
}

export function parseKofiBody(body: string): KofiWebhookPayload | null {
  try {
    if (body.trim().startsWith("{")) return JSON.parse(body) as KofiWebhookPayload;
    const params = new URLSearchParams(body);
    const data = params.get("data");
    if (data) return JSON.parse(data) as KofiWebhookPayload;
    return null;
  } catch {
    return null;
  }
}
