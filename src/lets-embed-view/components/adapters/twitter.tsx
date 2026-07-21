const { useState, useEffect } = window.React

// Widget mode: Full Twitter timeline embed (disabled for security)
// function TwitterWidget({ url }: { url: string }) {
//   return (
//     <iframe
//       src={`https://platform.twitter.com/embed Tweet.html?url=${encodeURIComponent(url)}`}
//       style={{ border: "none", width: "100%", minHeight: "400px" }}
//       title="Twitter Widget"
//     />
//   )
// }

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

// Link mode: Simple URL link
function TwitterLink({ url }: { url: string }) {
  return (
    <div style={{ padding: "12px" }}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--orca-color-primary)", textDecoration: "none" }}>
        {url}
      </a>
    </div>
  )
}

export const twitterAdapter = {
  name: "twitter",
  match: (url: string) => /twitter\.com|x\.com/.test(url),
  modes: {
    // widget: TwitterWidget,  // Disabled - requires external JS
    embed: TwitterEmbed,
    link: TwitterLink,
  },
  defaultMode: "embed" as const,
}
