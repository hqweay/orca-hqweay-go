export type DisplayMode = "widget" | "embed" | "card" | "link"

export type EmbedAdapter = {
  name: string
  match: (url: string) => boolean
  modes: Partial<Record<DisplayMode, (props: { url: string }) => JSX.Element>>
  defaultMode: DisplayMode
}

const adapters: EmbedAdapter[] = []

export function registerAdapter(adapter: EmbedAdapter) {
  adapters.push(adapter)
}

export function findAdapter(url: string): EmbedAdapter | undefined {
  return adapters.find((a) => a.match(url))
}

export function getAdapters(): EmbedAdapter[] {
  return adapters
}

export function getAvailableModes(adapter: EmbedAdapter): DisplayMode[] {
  return Object.keys(adapter.modes) as DisplayMode[]
}
