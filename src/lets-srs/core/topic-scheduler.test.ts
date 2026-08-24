import { describe, it, expect } from "vitest";
import {
  createEmptyTopicState,
  isTopicState,
  calculateTopicNextReview,
  predictTopicIntervals,
} from "./topic-scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("createEmptyTopicState", () => {
  it("returns a zeroed topic state", () => {
    expect(createEmptyTopicState()).toEqual({
      type: "topic",
      interval: 0,
      reps: 0,
      lastReviewed: null,
    });
  });
});

describe("isTopicState", () => {
  it("distinguishes topic states from other data", () => {
    expect(isTopicState({ type: "topic" })).toBe(true);
    expect(isTopicState({ type: "item" })).toBe(false);
    expect(isTopicState(null)).toBe(false);
    expect(isTopicState(undefined)).toBe(false);
  });
});

describe("calculateTopicNextReview", () => {
  const NOW = new Date(2026, 0, 1, 12, 0, 0);

  it("uses fixed initial intervals for new topics", () => {
    expect(calculateTopicNextReview(null, "soon", NOW).nextState.interval).toBe(1);
    expect(calculateTopicNextReview(null, "done", NOW).nextState.interval).toBe(3);
    expect(calculateTopicNextReview(null, "easy", NOW).nextState.interval).toBe(7);
  });

  it("increments reps and records review time on new topic", () => {
    const { nextState, nextDue } = calculateTopicNextReview(null, "done", NOW);
    expect(nextState.reps).toBe(1);
    expect(nextState.lastReviewed).toBe(NOW.getTime());
    expect(nextDue.getTime()).toBe(NOW.getTime() + 3 * DAY_MS);
  });

  it("multiplies interval on subsequent reviews", () => {
    const base = { type: "topic", interval: 10, reps: 3, lastReviewed: 1 } as const;
    expect(calculateTopicNextReview(base, "soon", NOW).nextState.interval).toBe(5);
    expect(calculateTopicNextReview(base, "done", NOW).nextState.interval).toBe(20);
    expect(calculateTopicNextReview(base, "easy", NOW).nextState.interval).toBe(40);
  });

  it("clamps interval between MIN and MAX", () => {
    const tiny = { type: "topic", interval: 1, reps: 5, lastReviewed: 1 } as const;
    expect(calculateTopicNextReview(tiny, "soon", NOW).nextState.interval).toBe(1);

    const huge = { type: "topic", interval: 100, reps: 5, lastReviewed: 1 } as const;
    expect(calculateTopicNextReview(huge, "easy", NOW).nextState.interval).toBe(180);
  });
});

describe("predictTopicIntervals", () => {
  it("predicts initial intervals for a new topic", () => {
    expect(predictTopicIntervals(null)).toEqual({ soon: 1, done: 3, easy: 7 });
  });

  it("predicts multiplied intervals for an existing topic", () => {
    const base = { type: "topic", interval: 10, reps: 3, lastReviewed: 1 } as const;
    expect(predictTopicIntervals(base)).toEqual({ soon: 5, done: 20, easy: 40 });
  });

  it("applies clamping in predictions", () => {
    const base = { type: "topic", interval: 100, reps: 3, lastReviewed: 1 } as const;
    expect(predictTopicIntervals(base).easy).toBe(180);
  });
});
