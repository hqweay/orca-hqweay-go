import React, { useState, useEffect } from "react"

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

// Card mode: platform.twitter.com/embed/Tweet.html iframe
function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}

function TwitterCard({ url }: { url: string }) {
  const tweetId = extractTweetId(url)

  if (!tweetId) {
    return <div style={{ padding: "12px", color: "var(--orca-color-error)", fontSize: "13px" }}>无法识别的推文链接</div>
  }

  return (
    <iframe
      src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&conversation=none&dnt=true&align=center`}
      style={{ border: "none", width: "100%", height: "500px", maxHeight: "600px", display: "block" }}
      title="Twitter Embed"
    />
  )
}

export const twitterAdapter = {
  name: "twitter",
  match: (url: string) => /twitter\.com|x\.com/.test(url),
  modes: {
    embed: TwitterEmbed,
    card: TwitterCard,
  },
  defaultMode: "embed" as const,
}
