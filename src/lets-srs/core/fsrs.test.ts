import { describe, it, expect } from "vitest";
import { calculateNextReview } from "./fsrs";

describe("calculateNextReview", () => {
  const NOW = new Date(2026, 0, 1, 12, 0, 0);

  it("schedules a new card on first review", () => {
    const { nextState, nextDue } = calculateNextReview(null, "good", NOW);
    expect(nextState.reps).toBe(1);
    expect(nextState.interval).toBeGreaterThanOrEqual(0);
    expect(nextState.stability).toBeGreaterThan(0);
    expect(nextState.difficulty).toBeGreaterThan(0);
    expect(nextState.lastReviewed).toBe(NOW.getTime());
    expect(nextDue.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("all four grades produce a valid card state", () => {
    for (const grade of ["again", "hard", "good", "easy"] as const) {
      const { nextState } = calculateNextReview(null, grade, NOW);
      expect(nextState.reps).toBe(1);
      expect(nextState.interval).toBeGreaterThanOrEqual(0);
    }
  });

  it("easy schedules further out than again for a new card", () => {
    const again = calculateNextReview(null, "again", NOW);
    const easy = calculateNextReview(null, "easy", NOW);
    expect(easy.nextDue.getTime()).toBeGreaterThan(again.nextDue.getTime());
  });

  it("advances an existing review card and keeps counts", () => {
    const first = calculateNextReview(null, "good", NOW);
    const second = calculateNextReview(first.nextState, "good", first.nextDue);
    expect(second.nextState.reps).toBe(2);
    expect(second.nextDue.getTime()).toBeGreaterThan(first.nextDue.getTime());
  });

  it("hard review grows interval slower than easy on an established card", () => {
    const first = calculateNextReview(null, "good", NOW);
    const hard = calculateNextReview(first.nextState, "hard", first.nextDue);
    const easy = calculateNextReview(first.nextState, "easy", first.nextDue);
    expect(easy.nextState.interval).toBeGreaterThan(hard.nextState.interval);
  });
});
