import React, { useState, useRef, useCallback, useEffect } from "react"

type Props = {
  children: React.ReactNode
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
  style?: React.CSSProperties
  height?: number
  onHeightChange?: (height: number) => void
}

export function ResizableBox({
  children,
  defaultHeight = 400,
  minHeight = 40,
  maxHeight = 1200,
  style,
  height: controlledHeight,
  onHeightChange,
}: Props) {
  const [height, setHeight] = useState(controlledHeight ?? defaultHeight)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    if (controlledHeight !== undefined) {
      setHeight(Math.max(minHeight, Math.min(maxHeight, controlledHeight)))
    }
  }, [controlledHeight, minHeight, maxHeight])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    setIsDragging(true)
    startYRef.current = e.clientY
    startHeightRef.current = containerRef.current?.offsetHeight ?? height
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
  }, [height])

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    if (containerRef.current) {
      const final = parseInt(containerRef.current.style.height)
      if (!isNaN(final)) {
        setHeight(final)
        onHeightChange?.(final)
      }
    }
  }, [onHeightChange])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return
    if (e.buttons === 0) {
      handleMouseUp()
      return
    }
    const delta = e.clientY - startYRef.current
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + delta))
    if (containerRef.current) {
      containerRef.current.style.height = `${newHeight}px`
    }
  }, [minHeight, maxHeight, handleMouseUp])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} style={{ position: "relative", overflow: "hidden", ...style, height: `${height}px` }}>
      <div style={{ width: "100%", height: "100%", pointerEvents: isDragging ? "none" : "auto" }}>
        {children}
      </div>
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 999,
            cursor: "row-resize",
          }}
        />
      )}
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
          zIndex: 1000,
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
