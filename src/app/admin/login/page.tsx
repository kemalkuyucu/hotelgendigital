import { redirect } from 'next/navigation'
import { getSessionAdmin } from '@/lib/auth/session'
import { loginAction } from '@/app/admin/actions/auth'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const admin = await getSessionAdmin()
  if (admin) redirect('/admin')

  const { error } = await searchParams

  const errorMessages: Record<string, string> = {
    missing: 'Kullanıcı adı ve şifre gerekli.',
    invalid: 'Kullanıcı adı veya şifre hatalı.',
    locked: 'Hesap 15 dakika kilitlendi. Lütfen bekleyin.',
  }

  return (
    <form
      action={loginAction}
      className="bg-white p-8 rounded-xl shadow-lg w-96 space-y-5 border border-gray-100"
    >
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">HotelGen Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Merkez Yönetim Paneli</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {errorMessages[error] ?? 'Bir hata oluştu.'}
        </div>
      )}

      <div className="space-y-3">
        <input
          id="username"
          name="username"
          placeholder="Kullanıcı adı"
          required
          autoComplete="username"
          className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Şifre"
          required
          autoComplete="current-password"
          className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Giriş Yap
      </button>
    </form>
  )
}
