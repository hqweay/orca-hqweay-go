---
trigger: always_on
---

# Orca Style & Global DOM Override Best Practices

## Context
When developing plugins where a component (e.g., custom panel, modal, sidebar) needs to temporarily modify, hide, or override application-wide CSS or global DOM elements, you must manage the style lifecycle reactively using React's component lifecycle rather than imperatively inside commands or event handlers.

## Core Rule: Component-Driven CSS/Style Lifecycle

Always bind the styling lifecycle to the React component that visually triggers it (e.g., a panel view) using `useEffect` with a cleanup callback. This guarantees that when the component is unmounted (for instance, if the user closes it manually using the side pane's `x` button, toggles it via commands, or disables/reloads the plugin), the style is automatically and cleanly reverted.

### Correct Implementation Pattern

```typescript
import React, { useEffect } from "react";
import applyCSSRule, { removeCSSRule } from "@/libs/styleUtil";

// CRITICAL: Define a unique, namespace-prefixed ID for your override rules.
const OVERRIDE_CSS_ID = "my-plugin-feature-hide-native-elements";

export const MyComponentPanel: React.FC = () => {
  useEffect(() => {
    // 1. Mount phase: Inject the style rule with the designated ID.
    applyCSSRule(`
      .host-native-panel { display: none !important; }
      .host-native-button { pointer-events: none !important; opacity: 0.5; }
    `, { id: OVERRIDE_CSS_ID });

    // 2. Unmount phase: Remove the style rule.
    return () => {
      removeCSSRule(OVERRIDE_CSS_ID);
    };
  }, []); // Empty dependency array ensures it only runs on mount and unmount.

  return (
    <div>
      {/* Component layout */}
    </div>
  );
};
```

### Why?
1. **Prevents Style Leaks**: If styles are applied inside commands, they will leak and remain active if the user closes the panel using UI buttons (like the built-in `x` button on Orca panels) or if the plugin is unloaded.
2. **Guaranteed Cleanup**: React's `useEffect` cleanup is guaranteed to run whenever the component leaves the DOM tree.
3. **Idempotence**: Providing a fixed ID to `applyCSSRule` ensures that even if the component is mounted multiple times or re-rendered, only one instance of the stylesheet is registered in the document `<head>`.
