# 3. FSRS Weights Management

Date: 2026-06-26

## Status

Accepted

## Context

The FSRS (Free Spaced Repetition Scheduler) algorithm utilizes a set of 17 parameters (weights) to determine optimal review intervals. When implementing FSRS across Topic (Note) and Item (Flashcard) systems in Orca, a decision was needed regarding where to store these algorithmic weights. 

Initially, it might seem intuitive to store the weights alongside the card data itself.

## Decision

We decided to store the 17 FSRS weights in Global Settings rather than attaching them on a per-card basis.

1. **Storage Mechanism**: The weights are stored globally. Users can input a comma-separated string of 17 numbers (following the v5 standard) into a single Textarea in the plugin settings.
2. **Type Differentiation (Advanced)**: We support configuring separate weight profiles globally for `Topic` vs. `Item` to accommodate gentler scheduling patterns for content consumption versus strict memorization.

## Consequences

- **Pros**: 
  - Prevents massive database bloat by not duplicating 17 floats on thousands of individual cards.
  - Allows for global optimization and seamless updating of the algorithmic weights across the entire user vault.
- **Cons**: 
  - Individual cards cannot have customized difficulty curves derived from highly specialized weights (though they still have their individual stability/difficulty histories).
