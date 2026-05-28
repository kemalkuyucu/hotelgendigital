'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MeetingRoom {
  ad: string;
  m2: number | string;
  en: number | string;
  boy: number | string;
  yukseklik: number | string;
  gun_isigi: boolean;
  tiyatro: number | string;
  sinif: number | string;
  u_duzen: number | string;
  banket: number | string;
  kokteyl: number | string;
}

const EMPTY_ROOM = (): MeetingRoom => ({
  ad: '', m2: '', en: '', boy: '', yukseklik: '', gun_isigi: false,
  tiyatro: '', sinif: '', u_duzen: '', banket: '', kokteyl: '',
});

function toNumber(v: number | string): number | null {
  const n = Number(v);
  return isNaN(n) || v === '' ? null : n;
}

function serializeRoom(r: MeetingRoom) {
  return {
    ad: r.ad,
    m2: toNumber(r.m2),
    en: toNumber(r.en),
    boy: toNumber(r.boy),
    yukseklik: toNumber(r.yukseklik),
    gun_isigi: !!r.gun_isigi,
    tiyatro: toNumber(r.tiyatro),
    sinif: toNumber(r.sinif),
    u_duzen: toNumber(r.u_duzen),
    banket: toNumber(r.banket),
    kokteyl: toNumber(r.kokteyl),
  };
}

// ─── Önerilen ekipmanlar (hızlı ekle) ────────────────────────────────────────
const EQUIPMENT_SUGGESTIONS = [
  'LCD Projeksiyon', 'Flipchart', 'Tepegöz', 'Barkovizyon',
  'Multimedya Player', 'Kablolu İnternet', 'Kablosuz İnternet',
  'İnteraktif TV', 'Akıllı Board', 'Mikrofon', 'Fax Sistemi',
  'Video Konferans', 'Ses Sistemi', 'Işık Sistemi', 'Kayıt Sistemi',
];

// ─── MeetingRoomsCard ─────────────────────────────────────────────────────────
export function MeetingRoomsCard() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [newEquipment, setNewEquipment] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [savingRooms, setSavingRooms] = useState(false);
  const [roomsToast, setRoomsToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [settingsCache, setSettingsCache] = useState<Record<string, unknown> | null>(null);
  const eqInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manager/hotel-settings', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json.settings) {
          setSettingsCache(json.settings as Record<string, unknown>);
          const mr = json.settings.meeting_rooms;
          if (Array.isArray(mr) && mr.length > 0) {
            setRooms(mr.map((r: MeetingRoom) => ({ ...EMPTY_ROOM(), ...r })));
          }
          const eq = json.settings.meeting_equipment;
          if (Array.isArray(eq)) {
            setEquipment(eq.filter((e: unknown) => typeof e === 'string'));
          }
        }
      } catch { /* ignore */ }
      finally { setLoadingRooms(false); }
    })();
  }, []);

  // ── Salon CRUD ───────────────────────────────────────────────────────────────
  const updateRoom = (idx: number, field: keyof MeetingRoom, val: string | boolean) => {
    setRooms((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };
  const addRoom = () => setRooms((prev) => [...prev, EMPTY_ROOM()]);
  const deleteRoom = (idx: number) => setRooms((prev) => prev.filter((_, i) => i !== idx));

  // ── Ekipman CRUD ─────────────────────────────────────────────────────────────
  const addEquipment = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || equipment.includes(trimmed)) return;
    setEquipment((prev) => [...prev, trimmed]);
    setNewEquipment('');
    setShowSuggestions(false);
  };

  const deleteEquipment = (idx: number) => {
    setEquipment((prev) => prev.filter((_, i) => i !== idx));
  };

  const filteredSuggestions = EQUIPMENT_SUGGESTIONS.filter(
    (s) => !equipment.includes(s) && s.toLowerCase().includes(newEquipment.toLowerCase())
  );

  // ── Kaydet ───────────────────────────────────────────────────────────────────
  const handleSaveRooms = async () => {
    setSavingRooms(true);
    setRoomsToast(null);
    try {
      const cache = settingsCache ?? {};
      const payload = {
        hotel_name: (cache.hotel_name as string) || 'Hotel',
        contact_phone: cache.contact_phone as string | null,
        contact_email: cache.contact_email as string | null,
        address: cache.address as string | null,
        concept_type: cache.concept_type as string | null,
        check_in_time: cache.check_in_time as string | null,
        check_out_time: cache.check_out_time as string | null,
        general_rules: cache.general_rules as string | null,
        location_info: cache.location_info ?? null,
        meeting_rooms: rooms.map(serializeRoom),
        meeting_equipment: equipment,
      };
      const res = await fetch('/api/manager/hotel-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setRoomsToast({ msg: json.error ?? 'Kaydedilemedi', type: 'error' });
      } else {
        setRoomsToast({ msg: 'Toplantı salonları ve ekipmanlar kaydedildi ✓', type: 'success' });
        const r2 = await fetch('/api/manager/hotel-settings', { credentials: 'include' });
        const j2 = await r2.json();
        if (r2.ok && j2.settings) setSettingsCache(j2.settings as Record<string, unknown>);
      }
    } catch {
      setRoomsToast({ msg: 'Sunucuya bağlanılamadı', type: 'error' });
    } finally {
      setSavingRooms(false);
      setTimeout(() => setRoomsToast(null), 3500);
    }
  };

  const numField = (idx: number, field: keyof MeetingRoom, width = 70) => (
    <input
      type="number"
      value={rooms[idx][field] as string | number}
      onChange={(e) => updateRoom(idx, field, e.target.value)}
      style={{
        width, padding: '4px 6px', border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
        fontSize: 13, outline: 'none', textAlign: 'right',
      }}
    />
  );

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      {/* ── Başlık + Satır Ekle ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>🏛️ Toplantı Salonları</h3>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Kapasite ve düzen bilgilerini girin</p>
        </div>
        <button
          id="meeting-rooms-add-btn"
          onClick={addRoom}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#c084fc',
          }}
        >
          + Satır Ekle
        </button>
      </div>

      {/* ── Toast ───────────────────────────────────────────────── */}
      {roomsToast && (
        <div style={{
          marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: roomsToast.type === 'success' ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${roomsToast.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: roomsToast.type === 'success' ? '#4ade80' : '#f87171',
        }}>{roomsToast.msg}</div>
      )}

      {/* ── Salon Tablosu ────────────────────────────────────────── */}
      {loadingRooms ? (
        <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Yükleniyor...</div>
      ) : rooms.length === 0 ? (
        <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          Henüz salon eklenmedi. &quot;+ Satır Ekle&quot; ile başlayın.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Salon Adı','m²','En','Boy','Yükseklik','Gün Işığı','Tiyatro','Sınıf','U Düzen','Banket','Kokteyl',''].map((h) => (
                  <th key={h} style={{
                    padding: '6px 8px', textAlign: h === 'Salon Adı' ? 'left' : 'right',
                    color: '#94a3b8', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      value={room.ad}
                      onChange={(e) => updateRoom(idx, 'ad', e.target.value)}
                      placeholder="Salon adı"
                      style={{
                        width: 140, padding: '4px 6px',
                        border: '1px solid rgba(168,85,247,0.25)', borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: 13, outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'm2', 70)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'en', 60)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'boy', 60)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'yukseklik', 70)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      id={`gun_isigi_${idx}`}
                      checked={!!room.gun_isigi}
                      onChange={(e) => updateRoom(idx, 'gun_isigi', e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#a855f7' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'tiyatro', 70)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'sinif', 65)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'u_duzen', 70)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'banket', 70)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{numField(idx, 'kokteyl', 70)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <button
                      id={`meeting-room-del-${idx}`}
                      onClick={() => deleteRoom(idx)}
                      title="Satırı sil"
                      style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', fontWeight: 600,
                      }}
                    >Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Teknik Ekipmanlar ─────────────────────────────────────── */}
      <div style={{
        marginTop: 28,
        paddingTop: 22,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            🔧 Teknik Ekipmanlar
          </h4>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Tüm salonlarda mevcut teknik donanım listesi (AI bağlamına otomatik eklenir)
          </p>
        </div>

        {/* Mevcut ekipman etiketleri */}
        {equipment.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {equipment.map((eq, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 20,
                  background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
                  color: '#c084fc', fontSize: 12, fontWeight: 500,
                }}
              >
                {eq}
                <button
                  id={`eq-del-${idx}`}
                  onClick={() => deleteEquipment(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%', fontSize: 10, lineHeight: 1,
                    background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)',
                    color: '#f87171', cursor: 'pointer', padding: 0, fontWeight: 700,
                  }}
                  title="Sil"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {equipment.length === 0 && !loadingRooms && (
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
            Henüz ekipman eklenmedi.
          </div>
        )}

        {/* Yeni ekipman ekle */}
        <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <input
              ref={eqInputRef}
              id="new-equipment-input"
              type="text"
              value={newEquipment}
              onChange={(e) => { setNewEquipment(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEquipment(newEquipment); } }}
              placeholder="Ekipman adı yaz veya seç..."
              style={{
                width: '100%', padding: '7px 12px',
                border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
                fontSize: 13, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {/* Öneri dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                marginTop: 4, borderRadius: 10,
                background: 'rgba(15,20,40,0.97)',
                border: '1px solid rgba(168,85,247,0.3)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => addEquipment(s)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', fontSize: 13, color: '#c084fc',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(168,85,247,0.15)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            id="eq-add-btn"
            onClick={() => addEquipment(newEquipment)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#c084fc',
              whiteSpace: 'nowrap',
            }}
          >
            + Ekle
          </button>
        </div>

        {/* Hızlı ekle chip'leri — eklenmemişler */}
        {EQUIPMENT_SUGGESTIONS.filter((s) => !equipment.includes(s)).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center', marginRight: 4 }}>Hızlı ekle:</span>
            {EQUIPMENT_SUGGESTIONS.filter((s) => !equipment.includes(s)).slice(0, 8).map((s) => (
              <button
                key={s}
                onClick={() => addEquipment(s)}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                  background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)',
                  color: '#94a3b8', fontWeight: 500,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Kaydet ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button
          id="meeting-rooms-save-btn"
          onClick={handleSaveRooms}
          disabled={savingRooms}
          style={{
            padding: '9px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: savingRooms ? 'rgba(168,85,247,0.1)' : 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)',
            border: '1px solid rgba(168,85,247,0.4)', color: '#fff',
            opacity: savingRooms ? 0.6 : 1,
          }}
        >
          {savingRooms ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-tab wrapper (page-level container) ───────────────────────────────────
export default function MeetingRoomsSubTab() {
  return (
    <div className="knowledge-root">
      <div className="knowledge-header">
        <h2 className="knowledge-title">Toplantı Salonları</h2>
      </div>
      <MeetingRoomsCard />
    </div>
  );
}
