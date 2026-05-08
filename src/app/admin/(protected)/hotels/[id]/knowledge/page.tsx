import { notFound } from 'next/navigation'
import { getCentralSupabase } from '@/lib/supabase-client'
import { KnowledgeClient } from './_components/knowledge-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function KnowledgePage({ params }: PageProps) {
  const { id } = await params
  const supabase = getCentralSupabase()

  const { data: hotel } = await supabase
    .from('hotels')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!hotel) notFound()

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between max-w-5xl">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <a href="/admin/hotels" className="hover:text-gray-700">Oteller</a>
            <span>›</span>
            <a href={`/admin/hotels/${id}`} className="hover:text-gray-700">{hotel.name}</a>
            <span>›</span>
            <span className="text-gray-800 font-medium">Bilgi Bankası</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            📚 Bilgi Bankası — {hotel.name}
          </h1>
        </div>
        <a
          href={`/admin/hotels/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2"
        >
          ← Otele Dön
        </a>
      </div>

      <KnowledgeClient hotelId={id} hotelName={hotel.name} />
    </div>
  )
}
