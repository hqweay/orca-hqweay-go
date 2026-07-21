import React, { useState, useEffect, useRef } from "react"

// Embed mode: oEmbed API - simplified card
function TwitterEmbed({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=1&dnt=1`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setHtml(data.html) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [url])

  if (error) return <div style={{ padding: "12px", color: "var(--orca-color-error)", fontSize: "13px" }}>加载失败</div>
  if (!html) return <div style={{ padding: "12px", opacity: 0.3, fontSize: "13px" }}>加载中...</div>
  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ padding: "8px 12px" }} />
}

// Card mode: platform.twitter.com/widgets.js SDK
function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}

function loadWidgetsJs(onReady: () => void) {
  if ((window as any).twttr?.widgets?.createTweet) {
    onReady()
    return
  }
  if ((window as any).twttr?.ready) {
    ;(window as any).twttr.ready(onReady)
    return
  }
  const script = document.createElement("script")
  script.src = "https://platform.twitter.com/widgets.js"
  script.async = true
  script.onload = () => {
    if ((window as any).twttr?.ready) {
      ;(window as any).twttr.ready(onReady)
    } else {
      onReady()
    }
  }
  document.body.appendChild(script)
}

function TwitterCard({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tweetId = extractTweetId(url)

  useEffect(() => {
    if (!tweetId || !containerRef.current) return
    const el = containerRef.current
    el.innerHTML = ""

    loadWidgetsJs(() => {
      if (!(window as any).twttr?.widgets?.createTweet) return
      ;(window as any).twttr.widgets.createTweet(tweetId, el, {
        theme: "dark",
        conversation: "none",
        align: "center",
        dnt: true,
      }).catch(() => {
        el.innerHTML = '<div style="padding:12px;color:var(--orca-color-error);font-size:13px">推文加载失败</div>'
      })
    })
  }, [tweetId])

  if (!tweetId) {
    return <div style={{ padding: "12px", color: "var(--orca-color-error)", fontSize: "13px" }}>无法识别的推文链接</div>
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <div ref={containerRef} />
      <noscript>
        <a href={url} style={{ padding: "12px", display: "block", opacity: 0.5, fontSize: "13px" }}>在 Twitter 上查看</a>
      </noscript>
    </div>
  )
}

// Widget mode: direct webview embedding of the Twitter page
function TwitterWidget({ url }: { url: string }) {
  return (
    <webview
      src={url}
      style={{ border: "none", width: "100%", height: "500px", maxHeight: "600px" }}
      partition="persist:embed"
      allowpopups
    />
  )
}

export const twitterAdapter = {
  name: "twitter",
  match: (url: string) => /twitter\.com|x\.com/.test(url),
  modes: {
    embed: TwitterEmbed,
    card: TwitterCard,
    widget: TwitterWidget,
  },
  defaultMode: "embed" as const,
}
