const DEFAULT_MAX_LINE_LENGTH = 58

const PROTECTED_LINE_PATTERNS = [
  /^件名[：:]/,
  /^---$/,
  /^https?:\/\//,
  /^▼/,
  /^・\d/,
  /^株式会社/,
  /^代表取締役/,
  /^Mail:/,
  /^Web:/,
]

function shouldProtectLine(line: string): boolean {
  return PROTECTED_LINE_PATTERNS.some((pattern) => pattern.test(line.trim()))
}

function findBreakIndex(text: string, maxLength: number): number {
  const slice = text.slice(0, maxLength + 1)
  const candidates = ['。', '、', '」', '）', '』', '】', ' ']

  for (const candidate of candidates) {
    const index = slice.lastIndexOf(candidate)
    if (index >= Math.floor(maxLength * 0.55)) {
      return index + candidate.length
    }
  }

  return maxLength
}

function wrapLine(line: string, maxLength: number): string {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length <= maxLength || shouldProtectLine(trimmed)) {
    return line
  }

  const chunks: string[] = []
  let rest = trimmed

  while (rest.length > maxLength) {
    const breakIndex = findBreakIndex(rest, maxLength)
    chunks.push(rest.slice(0, breakIndex).trim())
    rest = rest.slice(breakIndex).trim()
  }

  if (rest) chunks.push(rest)
  return chunks.join('\n')
}

export function wrapGeneratedText(text: string, maxLength = DEFAULT_MAX_LINE_LENGTH): string {
  return text
    .split('\n')
    .map((line) => wrapLine(line, maxLength))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
