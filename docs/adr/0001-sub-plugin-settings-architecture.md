# 1. Sub-Plugin Settings Architecture

Date: 2026-06-26

## Status

Accepted

## Context

As the Orca Note project grew, the number of sub-plugins increased. Orca's native `setSettingsSchema` was found to be too limiting for handling complex configurations, such as nested objects or dynamic lists, especially when multiple plugins try to register settings globally. 

## Decision

We adopted a "Master Switch + Self-Rendered Panel" architecture for sub-plugins.

1. **Layered Management**:
   - The master plugin registers only a basic boolean toggle ("Enable Sub-plugin") via the native settings schema.
   - A dedicated `SettingsBoard` modal (opened via commands or headbar buttons) handles detailed configurations.
2. **BasePlugin Abstraction**:
   - Sub-plugins define their configuration UI using React within the `renderSettings()` method.
   - Configurations are scoped automatically via `getSettings()` and `updateSettings()` to prevent key collisions (keys are automatically nested under the sub-plugin's namespace).
3. **UI Consistency**:
   - We utilize a shared set of layout components in `src/components/SettingsItem.tsx` to maintain a uniform style across all sub-plugin configurations.

## Consequences

- **Pros**: Sub-plugins can have arbitrarily complex, highly-customizable settings panels without fighting the host's native settings API. Key collisions are inherently prevented.
- **Cons**: Sub-plugin settings are detached from Orca's native settings menu, requiring users to open a custom modal to configure them.
