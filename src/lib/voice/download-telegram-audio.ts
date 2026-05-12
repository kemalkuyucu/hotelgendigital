/**
 * Telegram'dan bir ses dosyasını indirir.
 *
 * Akış:
 *   1. getFile API ile file_path al
 *   2. https://api.telegram.org/file/bot{token}/{file_path} URL'inden indir
 *   3. ArrayBuffer + dosya adı + mime type döner
 *
 * Limitler:
 *   - Telegram bot API: max 20MB indirme
 *   - Pratikte voice mesajlar <1MB (Opus codec çok efficient)
 */

interface TelegramFileInfo {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  };
}

export interface DownloadedAudio {
  buffer: ArrayBuffer;
  filename: string;        // "voice.oga" gibi
  mimeType: string;        // "audio/ogg"
  durationSeconds?: number;
}

export async function downloadTelegramAudio(params: {
  botToken: string;
  fileId: string;
  durationSeconds?: number;
}): Promise<DownloadedAudio> {
  const { botToken, fileId, durationSeconds } = params;

  // 1) getFile
  const infoRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const info: TelegramFileInfo = await infoRes.json();

  if (!info.ok || !info.result?.file_path) {
    throw new Error(`Telegram getFile failed: ${JSON.stringify(info)}`);
  }

  const filePath = info.result.file_path;
  const fileSize = info.result.file_size || 0;

  // Güvenlik: 20MB limit
  if (fileSize > 20 * 1024 * 1024) {
    throw new Error(`Audio file too large: ${fileSize} bytes (max 20MB)`);
  }

  // 2) İndir
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileRes = await fetch(fileUrl);

  if (!fileRes.ok) {
    throw new Error(`Telegram audio download failed: HTTP ${fileRes.status}`);
  }

  const buffer = await fileRes.arrayBuffer();

  // Mime / filename: voice = .oga (Opus in Ogg), audio = uzantısına göre
  const ext = filePath.split('.').pop()?.toLowerCase() || 'oga';
  const mimeType = ext === 'oga' || ext === 'ogg'
    ? 'audio/ogg'
    : ext === 'mp3' ? 'audio/mpeg'
    : ext === 'm4a' ? 'audio/mp4'
    : ext === 'wav' ? 'audio/wav'
    : 'audio/ogg';

  return {
    buffer,
    filename: `voice.${ext}`,
    mimeType,
    durationSeconds,
  };
}
