import { describe, it, expect, beforeEach } from "vitest";
import { roamSidebarState, addStackedBlock, moveStackedBlock } from "../state";

describe("moveStackedBlock", () => {
  beforeEach(() => {
    roamSidebarState.stackedBlocks = [];
  });

  it("moves a block from one position to another", () => {
    addStackedBlock(1); // [1]
    addStackedBlock(2); // [2, 1]
    addStackedBlock(3); // [3, 2, 1]

    moveStackedBlock(3, 1); // move 3 to index 1: [2, 3, 1]

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 3, 1]);
  });

  it("does nothing if fromIndex equals toIndex", () => {
    addStackedBlock(1);
    addStackedBlock(2);

    moveStackedBlock(1, 1);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 1]);
  });

  it("does nothing if block not found", () => {
    addStackedBlock(1);

    moveStackedBlock(999, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([1]);
  });
});
