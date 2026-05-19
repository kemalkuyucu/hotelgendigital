/**
 * Module 17.d - ManyChat (WhatsApp) send helper
 * Uses ManyChat Send Content API
 * Requires: MANYCHAT_API_KEY env variable
 */

export interface SendManychatParams {
  subscriberId: string;  // ManyChat subscriber_id (more stable than phone)
  message: string;
}

export interface SendManychatResult {
  success: boolean;
  error?: string;
}

export async function sendManychat(
  params: SendManychatParams,
): Promise<SendManychatResult> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) {
    const msg = '[send-manychat] MANYCHAT_API_KEY env variable not set';
    console.error(msg);
    return { success: false, error: 'MANYCHAT_API_KEY not configured. Please add this env variable.' };
  }

  try {
    const body = {
      subscriber_id: params.subscriberId,
      data: {
        messages: [
          {
            type: 'text',
            text: params.message,
          },
        ],
      },
    };

    const res = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      status?: string;
      message?: string;
    };

    if (!res.ok || json.status === 'error') {
      const errMsg = json.message ?? `HTTP ${res.status}`;
      console.error(`[send-manychat] API error → subscriberId=${params.subscriberId}:`, errMsg);
      return { success: false, error: errMsg };
    }

    console.log(`[send-manychat] OK → subscriberId=${params.subscriberId}`);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    console.error(`[send-manychat] Exception → subscriberId=${params.subscriberId}:`, errMsg);
    return { success: false, error: errMsg };
  }
}
