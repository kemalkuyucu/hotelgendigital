// src/app/group-admin/[slug]/dashboard/page.tsx
// Modül 22 Faz 1 — Grup Yöneticisi Dashboard İskeleti
// Session doğrulama + boş placeholder kart. Rapor mantığı Faz 2-3'te.

import { redirect } from 'next/navigation'
import { getGroupManagerFromCookie } from '@/lib/group-admin/auth'
import GroupDashboardClient from './_dashboard-client'

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Cookie doğrula — yoksa login'e yönlendir
  const manager = await getGroupManagerFromCookie()
  if (!manager) {
    redirect(`/group-admin/${slug}/login`)
  }

  // Slug eşleşme kontrolü
  if (manager.group_slug !== slug) {
    redirect(`/group-admin/${slug}/login`)
  }

  return <GroupDashboardClient slug={slug} manager={manager} />
}
