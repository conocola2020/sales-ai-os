/**
 * 文面生成でAnthropic APIを使ってよいか。
 * 既定は無効（API課金なしのテンプレート生成のみ）。
 * 有効化するには NEXT_PUBLIC_ENABLE_AI_GENERATION=true を明示的に設定する。
 * NEXT_PUBLIC_ なのはUI側（生成モード切替の表示）と判定を揃えるため。
 */
export function isAiGenerationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AI_GENERATION === 'true'
}

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return key
}
