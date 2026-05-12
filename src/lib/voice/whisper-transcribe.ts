/**
 * OpenAI Whisper API ile ses dosyasını yazıya döker.
 *
 * Endpoint: POST https://api.openai.com/v1/audio/transcriptions
 * Model: whisper-1
 * Fiyat: $0.006 / dakika (2026 itibarıyla)
 *
 * Dönüş: { text, language?, durationSeconds? }
 *
 * Notlar:
 *   - language param verilmezse Whisper otomatik algılar (önerilen)
 *   - Misafir Türkçe, İngilizce, Almanca, Rusça, Arapça konuşabilir — auto-detect
 *   - response_format=verbose_json kullanırsak detected language gelir
 */

export interface WhisperTranscript {
  text: string;
  language?: string;        // "tr", "en", "de", vs. (ISO 639-1)
  durationSeconds?: number;
}

export async function whisperTranscribe(params: {
  audioBuffer: ArrayBuffer;
  filename: string;
  mimeType: string;
  promptHint?: string;      // Otelin adı, tipik kelimeler — accuracy boost için opsiyonel
}): Promise<WhisperTranscript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing');
  }

  // multipart/form-data hazırlama
  const formData = new FormData();
  const blob = new Blob([params.audioBuffer], { type: params.mimeType });
  formData.append('file', blob, params.filename);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  if (params.promptHint) {
    formData.append('prompt', params.promptHint);
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${errBody}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  return {
    text: (json.text || '').trim(),
    language: json.language || undefined,
    durationSeconds: json.duration || undefined,
  };
}
