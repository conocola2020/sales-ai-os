import type { Lead } from '@/types/leads'

export function detectContactMethod(lead: Lead): 'form' | 'email' | 'instagram' | 'none' {
  if (lead.email) return 'email'
  if (lead.instagram_url) return 'instagram'
  if (lead.website_url || lead.company_url) return 'form'
  return 'none'
}
