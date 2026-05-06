'use client'
import { useState } from 'react'

export default function TestBridgeButton({ hotelId }: { hotelId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    message: string
    latencyMs: number
  } | null>(null)

  const onTest = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/test-bridge`, {
        method: 'POST',
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message, latencyMs: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onTest}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Test ediliyor...
          </>
        ) : (
          <>🔌 Bağlantıyı Test Et</>
        )}
      </button>
      {result && (
        <div
          className={`p-4 rounded-lg text-sm border ${
            result.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="font-semibold mb-1">
            {result.ok ? '✅ Bağlantı Başarılı' : '❌ Bağlantı Hatası'}
          </div>
          <div>{result.message}</div>
          <div className="text-xs opacity-60 mt-2">{result.latencyMs} ms</div>
        </div>
      )}
    </div>
  )
}
