export type DisplayMode = "widget" | "embed" | "card" | "link" | "iframe" | "webview"

export type EmbedAdapter = {
  name: string
  match: (url: string) => boolean
  modes: Partial<Record<DisplayMode, (props: { url: string; height?: number; onHeightChange?: (h: number) => void; onSwitchMode?: (mode: DisplayMode) => void }) => JSX.Element>>
  defaultMode: DisplayMode
}

const adapters: EmbedAdapter[] = []

export function registerAdapter(adapter: EmbedAdapter) {
  if (!adapters.find((a) => a.name === adapter.name)) {
    adapters.push(adapter)
  }
}

export function unregisterAdapter(name: string) {
  const idx = adapters.findIndex((a) => a.name === name)
  if (idx !== -1) adapters.splice(idx, 1)
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
