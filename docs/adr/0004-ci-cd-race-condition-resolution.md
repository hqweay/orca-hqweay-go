# 4. CI/CD Race Condition Resolution

Date: 2026-06-26

## Status

Accepted

## Context

Our automated release workflow involves pushing tags to trigger a GitHub Action (`release.yml`), which compiles release notes and updates the registry. Previously, a local bash script sequentially executed `git push --tags` followed immediately by `gh workflow run update-registry.yml`. 

This created a severe race condition: the downstream registry updater would attempt to fetch GitHub Release Notes before the upstream `release.yml` action had finished generating and publishing them. 

## Decision

We eliminated the race condition entirely by removing external script polling and utilizing Git Commit Flags combined with downstream conditional triggers in GitHub Actions.

1. **Commit Flags**: The local release script appends a specialized flag to the commit message (e.g., `git commit -m "release: v3.0.0 [update registry]"`).
2. **Conditional Downstream Trigger**: The `release.yml` action is responsible for orchestrating the next step. At the very end of its successful run, a step evaluates the commit message:
   `if: contains(github.event.head_commit.message, '[update registry]')`
   If the condition is met, `release.yml` triggers `update-registry.yml`.

## Consequences

- **Pros**: 
  - Zero race conditions. The downstream action is guaranteed to start only after the upstream action has fully published the release.
  - Zero brittle polling (`sleep` or `while` loops in bash) which wastes CI minutes.
  - Retains granular local control (the developer can opt-in to "Release Only" or "Release + Registry Update" just by altering the commit message flag).
- **Cons**: Requires standardizing the commit message syntax across the team for release triggers.
