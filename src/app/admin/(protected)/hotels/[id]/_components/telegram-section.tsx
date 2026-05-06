'use client';

import { useState, useTransition } from 'react';
import { refreshTelegramWebhook } from '../actions';

interface Props {
  hotelId: string;
  hotelSlug: string;
  managerChatId: number | null;
  webhookInfo?: {
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  } | null;
}

export function TelegramSection({ hotelId: _hotelId, hotelSlug, managerChatId, webhookInfo }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string>('');

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const r = await refreshTelegramWebhook(hotelSlug);
        setResult(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
      } catch (e) {
        setResult(`❌ ${(e as Error).message}`);
      }
    });
  };

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">📨 Telegram Bot</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-gray-500">Yönetici Chat ID</dt>
          <dd className="font-mono">{managerChatId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Webhook URL</dt>
          <dd className="break-all font-mono">{webhookInfo?.url || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Bekleyen Update</dt>
          <dd>{webhookInfo?.pending_update_count ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Son Hata</dt>
          <dd className="text-red-600">{webhookInfo?.last_error_message || '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Yenileniyor...' : "Webhook'u Yenile"}
        </button>
        {result && <span className="text-sm">{result}</span>}
      </div>
    </section>
  );
}
