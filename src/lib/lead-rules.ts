/**
 * リード登録の資格条件（2026-07-17 オーナー決定）
 *
 * リードとして登録できるのは「メールアドレス」または「問い合わせフォームURL」を
 * 持つ企業のみ。どちらも無い場合はリードにしない
 * （Instagramのみの店舗は instagram_targets 側で管理する）。
 *
 * 収集パイプライン（promote-prospects）は昇格条件でこのルールを満たすため、
 * ここでは手動追加・CSVインポートの抜け道を塞ぐ。
 */

interface ContactFields {
  email?: string | null
  contact_url?: string | null
}

export const LEAD_CONTACT_RULE_MESSAGE =
  'メールアドレスか問い合わせフォームURLのどちらかが必要です（どちらも無い企業はリードに登録できません。Instagramのみの店舗はInstagramターゲットへ）'

export function hasRequiredContact(lead: ContactFields): boolean {
  const email = lead.email?.trim()
  const contactUrl = lead.contact_url?.trim()
  return Boolean(email || contactUrl)
}

/** 一括登録用: 条件を満たす行と除外件数に分ける */
export function splitByContactRule<T extends ContactFields>(rows: T[]): { valid: T[]; skipped: number } {
  const valid = rows.filter(hasRequiredContact)
  return { valid, skipped: rows.length - valid.length }
}
