import type { Lead } from '@/types/leads'

export function detectContactMethod(lead: Lead): 'form' | 'email' | 'instagram' | 'manual' | 'none' {
  // DB上の検出済み contact_method を優先
  if (lead.contact_method) return lead.contact_method as 'form' | 'email' | 'instagram' | 'manual' | 'none'
  // 未検出の場合はメールアドレスの有無で簡易判定
  if (lead.email) return 'email'
  if (lead.instagram_url) return 'instagram'
  // HPがあってもフォームがあるとは限らない → 'none' を返す（以前は 'form' を返していた）
  return 'none'
}
