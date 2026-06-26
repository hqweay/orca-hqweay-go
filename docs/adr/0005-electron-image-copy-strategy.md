# 5. Electron Image Copy Strategy

Date: 2026-06-26

## Status

Accepted

## Context

In the Electron environment, we needed a way to copy images from a Webview into the system clipboard. However, we encountered several roadblocks:
1. **CORS Limitations**: The image server disallowed cross-origin fetch, making it impossible to get the Blob directly.
2. **Hotlinking Prevention (防盗链)**: The image server checked the `Referer` header, causing requests from the host environment to fail.
3. **Security Restrictions**: Running `document.execCommand('copy')` inside the Webview failed asynchronously without user interaction, or only copied HTML/URL text instead of image data.

## Decision

We implemented an "Auto-Scroll + capturePage" strategy to bypass the network layer entirely:

1. **Webview Script Injection**: We execute a script to locate the target `img` element and forcefully scroll it into the center of the viewport (`scrollIntoView({block: 'center'})`), returning its bounding coordinates.
2. **Host-side Capture**: We utilize Electron's Webview `capturePage` method to take a screenshot of those specific coordinates.
3. **Clipboard Write**: We convert the resulting NativeImage to a Blob and write it to the clipboard (`navigator.clipboard.write`).

## Consequences

- **Pros**: 
  - Completely bypasses CORS and hotlinking restrictions since we are just taking a screenshot of what is already rendered.
  - Copies raw binary image data, allowing users to paste it directly into WeChat or image editors.
- **Cons**: 
  - **Viewport Limitation**: If the image is partially obscured, off-screen, or larger than the viewport, the screenshot will be cropped.
  - **Quality Dependency**: The captured image quality is dependent on the user's screen scaling (DPI) rather than the original image file resolution.
