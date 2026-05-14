'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ManagerTopBarProps {
  onLogout: () => void;
  loggingOut: boolean;
}

export default function ManagerTopBar({ onLogout, loggingOut }: ManagerTopBarProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string>('Yönetici');

  useEffect(() => {
    fetch('/api/manager/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => {/* silently ignore */});
  }, []);

  return (
    <header className="manager-topbar">
      {/* SOL — Sunuma Dön */}
      <button
        className="manager-topbar-back"
        onClick={() => router.push('/')}
        aria-label="Sunuma Dön"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Sunuma Dön</span>
      </button>

      {/* ORTA — Başlık */}
      <div className="manager-topbar-title">
        {/* Mor Kalkan İkonu */}
        <span className="manager-topbar-shield">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <span id="manager-dashboard-title">VIP Yönetici Paneli</span>
      </div>

      {/* SAĞ — User Badge + Logout */}
      <div className="manager-topbar-right">
        <div className="manager-user-badge">
          <span className="manager-user-avatar">
            {username.charAt(0).toUpperCase()}
          </span>
          <span className="manager-user-name">{username}</span>
        </div>

        <button
          className="manager-logout-btn"
          onClick={onLogout}
          disabled={loggingOut}
          id="manager-logout-btn"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {loggingOut ? 'Çıkılıyor...' : 'Çıkış Yap'}
        </button>
      </div>
    </header>
  );
}
