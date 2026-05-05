# 🤖 MODUL 1 — ANTIGRAVITY EXECUTION TASK

> **For: Antigravity AI Assistant**
> **Project: HotelGen v2 — Multi-tenant Hotel Automation SaaS**
> **Module: 1 — Foundation Layer**
>
> Read this entire document FIRST. Then execute steps in EXACT order.
> After each step, report `[step N done]` before continuing.
> Do NOT improve, refactor, or interpret. Copy-paste exactly.

---

## CONTEXT

You are bootstrapping a Next.js 16 + Supabase + TypeScript multi-tenant SaaS.
The codebase is empty. You will create:

- A clean folder structure under `src/`
- TypeScript modules for Supabase clients, tenant resolver, encryption
- A health-check API endpoint
- Configuration files (package.json, tsconfig.json, .env.example, .gitignore)

You will NOT:
- Write any business logic (departments, AI calls, webhooks) — those come in later modules
- Create UI components — those come in Module 7+
- Handle real API keys — env values are set in Vercel by the human, not by you

---

## STACK CONSTRAINTS (DO NOT CHANGE)

- Next.js: `16.1.6` (App Router)
- React: `19.2.3`
- TypeScript: `5.x` strict mode
- TailwindCSS: `4.x`
- Supabase JS: `^2.98.0`
- Anthropic SDK: `^0.80.0`
- OpenAI SDK: `^6.25.0`
- Resend: `^4.0.0`
- Node version: `>=20`

---

## STEP 1 — INITIALIZE PROJECT

Create files at the repo root:

### 1.1 `package.json`

```json
{
  "name": "hotelgen-v2",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.80.0",
    "@supabase/supabase-js": "^2.98.0",
    "next": "16.1.6",
    "openai": "^6.25.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### 1.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 1.3 `next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
```

### 1.4 `.gitignore`

```
# Dependencies
node_modules/
/.pnp
.pnp.*

# Testing
/coverage

# Next.js
/.next/
/out/
*.tsbuildinfo

# Production
/build

# Environment variables — NEVER commit
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.*.local

# Vercel
.vercel

# IDE & OS
.vscode/
.idea/
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# TypeScript
next-env.d.ts

# Local development
*.local
.local/

# Backup files & secrets
**/credentials/
**/*-credentials.*
**/secrets/
*.key
*.pem
*.cert

# Logs
logs/
*.log
```

### 1.5 `.env.example`

(Use the template the human provides — copy verbatim. Do not invent values.)

After creating these 5 files, run:
```bash
npm install
```

Report `[step 1 done]`.

---

## STEP 2 — CREATE FOLDER STRUCTURE

Create these directories (empty files with .gitkeep where needed):

```
src/
├── app/
│   ├── api/
│   │   └── health-check/
│   │       └── .gitkeep
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   └── .gitkeep
├── config/
│   └── .gitkeep
├── types/
│   └── .gitkeep
└── styles/
    └── .gitkeep
```

### 2.1 `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HotelGen',
  description: 'Hotel Automation SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
```

### 2.2 `src/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>HotelGen</h1>
      <p>Multi-tenant hotel automation platform.</p>
      <p>System is live. Check <a href="/api/health-check">/api/health-check</a> for status.</p>
    </main>
  );
}
```

### 2.3 `src/app/globals.css`

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

Report `[step 2 done]`.

---

## STEP 3 — CREATE LIB MODULES

Create these files in `src/lib/`. Use the EXACT content the human provides:

### 3.1 `src/lib/encryption.ts`

(Copy from `code-templates/encryption.ts` — provided by human)

### 3.2 `src/lib/supabase-client.ts`

(Copy from `code-templates/supabase-client.ts` — provided by human)

### 3.3 `src/lib/tenant-resolver.ts`

(Copy from `code-templates/tenant-resolver.ts` — provided by human)

### 3.4 `src/lib/index.ts`

```ts
export { getCentralSupabase, getDemoHotelSupabase, resetSupabaseClients } from './supabase-client';
export { encryptCredential, decryptCredential, testEncryptionRoundTrip } from './encryption';
export { resolveTenant, invalidateTenantCache, TenantNotFoundError, TenantSuspendedError } from './tenant-resolver';
export type { TenantContext, ChannelType } from './tenant-resolver';
```

Report `[step 3 done]`.

---

## STEP 4 — CREATE HEALTH CHECK ENDPOINT

### 4.1 `src/app/api/health-check/route.ts`

(Copy from `code-templates/health-check-route.ts` — provided by human)

### 4.2 Remove the `.gitkeep` from health-check folder

Report `[step 4 done]`.

---

## STEP 5 — CREATE TYPES MODULE

### 5.1 `src/types/database-central.ts`

```ts
/**
 * Type definitions for Central Supabase tables.
 * Module 2 will replace this with auto-generated types from Supabase CLI.
 */

export interface Package {
  id: string;
  code: 'basic' | 'full' | 'premium';
  display_name: string;
  description: string | null;
  features: Record<string, unknown>;
  monthly_price_usd: number | null;
  is_active: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  package_id: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_months: number | null;
  monthly_revenue_usd: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: 'active' | 'suspended' | 'cancelled' | 'demo';
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BridgeCredentials {
  id: string;
  hotel_id: string;
  supabase_url_encrypted: string;
  supabase_anon_key_encrypted: string;
  supabase_service_key_encrypted: string;
  is_healthy: boolean;
  last_verified_at: string | null;
}

export interface ChannelRouting {
  id: string;
  hotel_id: string;
  channel_type: 'whatsapp' | 'telegram' | 'instagram';
  channel_identifier: string;
  is_active: boolean;
}

export interface MasterAdmin {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'support' | 'default_admin';
  is_active: boolean;
  last_login_at: string | null;
}
```

### 5.2 `src/types/database-hotel.ts`

```ts
/**
 * Type definitions for Hotel Supabase tables (per-hotel DB).
 */

export type DepartmentCode =
  | 'front_office'
  | 'housekeeping'
  | 'technical'
  | 'fb'
  | 'guest_relation'
  | 'spa'
  | 'animation';

export type ChannelType = 'whatsapp' | 'telegram' | 'instagram';

export interface InhouseGuest {
  id: string;
  room_number: string;
  full_name: string;
  agency: string | null;
  voucher: string | null;
  pax: number;
  check_in_date: string;
  check_out_date: string;
  channel_ids: string[];
  language: string | null;
  vip_status: 'standard' | 'repeat' | 'loyalty' | 'vip';
  is_active: boolean;
}

export interface CustomerFacts {
  id: string;
  channel_type: ChannelType;
  channel_id: string;
  guest_id: string | null;
  full_name: string | null;
  room_number: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  language: string | null;
  allergies: string[];
  dietary_preferences: string[];
  special_requests: string[];
  open_complaint: string | null;
  vip_status: string | null;
  metadata: Record<string, unknown>;
  last_updated_at: string;
}

export interface Department {
  id: string;
  code: DepartmentCode;
  display_name: string;
  is_enabled: boolean;
  sla_minutes: number;
  working_hours: Array<{ day: number; start: string; end: string }>;
  off_hours_behavior: 'forward_to_reception' | 'wait_until_business' | 'reject';
  notification_channel_priority: 'whatsapp' | 'telegram' | 'both';
}

export interface Request {
  id: string;
  ticket_number: string | null;
  channel_type: ChannelType | null;
  channel_id: string | null;
  guest_id: string | null;
  room_number: string | null;
  full_name: string | null;
  request_text: string;
  request_text_tr: string | null;
  language: string;
  intent: string | null;
  department_id: string | null;
  status: 'pending' | 'acknowledged_now' | 'acknowledged_later' | 'in_progress' | 'resolved' | 'escalated' | 'cancelled';
  priority: 'normal' | 'high' | 'emergency';
  is_emergency: boolean;
  is_off_hours: boolean;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_minutes: number | null;
  sla_breached: boolean;
}
```

Report `[step 5 done]`.

---

## STEP 6 — POSTCSS & TAILWIND CONFIG

### 6.1 `postcss.config.mjs`

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

### 6.2 Update `src/app/globals.css`

Replace existing content with:

```css
@import "tailwindcss";

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

Report `[step 6 done]`.

---

## STEP 7 — VERIFY BUILD

Run these commands in order. Each must succeed:

```bash
npm run type-check
```
Expected: No errors. If errors appear, STOP and report them. Do NOT modify code to "fix" type errors.

```bash
npm run lint
```
Expected: No errors. Warnings ok.

```bash
npm run build
```
Expected: "Compiled successfully" message.

Report `[step 7 done]` with the build output's last 5 lines.

---

## STEP 8 — GIT COMMIT

```bash
git add .
git commit -m "Module 1: Foundation layer

- Multi-tenant Supabase client architecture
- Tenant resolver with in-memory cache
- AES-256-GCM credential encryption
- Health check endpoint at /api/health-check
- TypeScript strict mode, Next.js 16 App Router
- Folder structure: lib, config, types, app/api"

git push origin main
```

Report `[step 8 done]` with the commit hash.

---

## STEP 9 — FINAL REPORT

After all steps complete, output this summary:

```
✅ MODULE 1 COMPLETE

Files created: <count>
Folders created: <count>
Build status: success
Git commit: <hash>
Pushed to: origin/main

Next: Human deploys to Vercel and tests /api/health-check
```

---

## RULES FOR THIS TASK

1. **Do not add files I did not list above.** No README's, no docs, no extra utils.
2. **Do not modify version numbers** in package.json.
3. **Do not "improve" code** — even if you see a chance to refactor.
4. **Do not skip type errors.** If TypeScript complains, report and stop.
5. **Do not commit `.env.local`** if you accidentally created one — verify .gitignore catches it.
6. **Do not run `npm audit fix`** or similar mutations.
7. **Stop at any error.** Don't try to "fix" anything autonomously. Report and wait for human.

Acknowledge by replying: `Module 1 task understood. Starting at step 1.`
