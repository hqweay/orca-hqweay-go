import type { EmbedMode } from "./types"

export function detectMode(input: string): EmbedMode {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return "url"
  return "html"
}
