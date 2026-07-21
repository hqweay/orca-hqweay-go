export type EmbedAdapter = {
  name: string
  match: (url: string) => boolean
  Preview: (props: { url: string }) => JSX.Element | null
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
