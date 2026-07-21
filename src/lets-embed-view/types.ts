export type EmbedMode = "url" | "html"

export type EmbedData = {
  mode: EmbedMode
  url?: string
  html?: string
}

export type { DisplayMode } from "./components/adapters/registry"
