'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const THROTTLE_MS = 1000;

export function useIdleTimeout(timeoutMs: number = 5 * 60 * 1000): void {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(0);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/manager/logout', { method: 'POST' });
    } catch {
      // Hata olsa bile yönlendir
    } finally {
      router.push('/manager/login?session=expired');
    }
  }, [router]);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    // Throttle: son resetden bu yana 1 saniye geçmediyse hiçbir şey yapma
    if (now - lastResetRef.current < THROTTLE_MS) return;
    lastResetRef.current = now;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, timeoutMs);
  }, [logout, timeoutMs]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ];

    // İlk başlatma
    resetTimer();

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}
