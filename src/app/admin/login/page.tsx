import { redirect } from 'next/navigation'
import { getSessionAdmin } from '@/lib/auth/session'
import AdminLoginForm from './_form-client'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const admin = await getSessionAdmin()
  if (admin) redirect('/admin')

  const { error } = await searchParams

  return <AdminLoginForm error={error} />
}
