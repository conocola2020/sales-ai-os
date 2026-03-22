export function getAnthropicApiKey(): string {
  return process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key-here'
}
