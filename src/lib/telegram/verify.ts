/**
 * Constant-time string karşılaştırması (timing attack koruması).
 * Webhook secret/imza doğrulamaları için tek kaynak (AUDIT S8).
 * Boş expected veya null header → false (fail-closed).
 */
export function timingSafeEqualStr(
  headerValue: string | null,
  expectedSecret: string,
): boolean {
  if (!expectedSecret) return false;
  if (!headerValue) return false;
  if (headerValue.length !== expectedSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerValue.length; i++) {
    mismatch |= headerValue.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Telegram webhook secret token doğrulaması.
 * setWebhook çağrısında secret_token verdiysek, Telegram her POST'ta
 * X-Telegram-Bot-Api-Secret-Token header'ı ile bunu gönderir.
 */
export function verifyTelegramSecret(
  headerValue: string | null,
  expectedSecret: string,
): boolean {
  return timingSafeEqualStr(headerValue, expectedSecret);
}
