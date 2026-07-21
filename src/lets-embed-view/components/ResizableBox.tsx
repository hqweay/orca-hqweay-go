import React, { useState, useRef, useCallback, useEffect } from "react"

type Props = {
  children: React.ReactNode
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
  style?: React.CSSProperties
}

export function ResizableBox({ children, defaultHeight = 400, minHeight = 200, maxHeight = 800, style }: Props) {
  const [height, setHeight] = useState(defaultHeight)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = height
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
  }, [height])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return
    const delta = e.clientY - startYRef.current
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + delta))
    setHeight(newHeight)
  }, [minHeight, maxHeight])

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div style={{ position: "relative", overflow: "hidden", ...style, height }}>
      {children}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "8px",
          cursor: "row-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{
          width: "36px",
          height: "3px",
          borderRadius: "2px",
          background: "var(--orca-color-border-2)",
          opacity: 0.5,
        }} />
      </div>
    </div>
  )
}
