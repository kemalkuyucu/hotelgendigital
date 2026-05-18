import { getCentralSupabase } from '@/lib/supabase-client'
import SafetyRulesClient from './_safety-rules-client'

export interface SafetyRule {
  id: string
  category: string | null
  title: string
  description: string | null
  ai_instruction: string
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default async function SafetyRulesPage() {
  const supabase = getCentralSupabase()
  const { data: rules } = await supabase
    .from('system_safety_responses')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  return <SafetyRulesClient initialRules={(rules as SafetyRule[]) ?? []} />
}
