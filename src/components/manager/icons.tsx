/**
 * Manager panel inline SVG icons.
 * No external icon library required — all paths are hand-coded.
 * Style contract:
 *   viewBox="0 0 24 24"  fill="none"  stroke="currentColor"
 *   strokeWidth={2}  strokeLinecap="round"  strokeLinejoin="round"
 */

interface IconProps {
  className?: string;
  size?: number;
}

function base(size: number, className: string, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ── Departman ikonları ──────────────────────────────────────────── */

/** front_office — bina / resepsiyon */
export function FrontOfficeIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>);
}

/** fb — çatal & bıçak (F&B / restoran) */
export function FBIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z" />
    <line x1="21" y1="15" x2="21" y2="22" />
  </>);
}

/** housekeeping — yatak */
export function HousekeepingIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" />
  </>);
}

/** technical — anahtar / tamir */
export function TechnicalIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </>);
}

/** guest_relation — el sıkışma / kalp */
export function GuestRelationIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </>);
}

/** spa — kıvılcım / yıldız */
export function SpaIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <path d="M12 3c-4.97 0-9 4.03-9 9h18c0-4.97-4.03-9-9-9z" />
    <path d="M3 12c0 4.97 4.03 9 9 9s9-4.03 9-9" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </>);
}

/** animation — parti / eğlence */
export function AnimationIcon({ size = 20, className = 'w-5 h-5' }: IconProps) {
  return base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </>);
}

/* ── Stat chip ikonları ─────────────────────────────────────────── */

/** users — personel sayısı */
export function UsersIcon({ size = 13, className = '' }: IconProps) {
  return base(size, className, <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>);
}

/** clock — SLA süresi */
export function ClockIcon({ size = 13, className = '' }: IconProps) {
  return base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>);
}

/** bell — bildirim kanalı */
export function BellIcon({ size = 13, className = '' }: IconProps) {
  return base(size, className, <>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>);
}
