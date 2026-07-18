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

describe("moveStackedBlock edge cases", () => {
  beforeEach(() => {
    roamSidebarState.stackedBlocks = [];
  });

  it("moves block to beginning", () => {
    addStackedBlock(1);
    addStackedBlock(2);
    addStackedBlock(3); // [3, 2, 1]

    moveStackedBlock(2, 0); // move 2 from index 1 to index 0

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 3, 1]);
  });

  it("moves block to end", () => {
    addStackedBlock(1);
    addStackedBlock(2);
    addStackedBlock(3); // [3, 2, 1]

    moveStackedBlock(3, 2); // move 3 from index 0 to index 2

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([2, 1, 3]);
  });

  it("handles single element list", () => {
    addStackedBlock(1);

    moveStackedBlock(1, 0);

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([1]);
  });

  it("moves block down to a middle position (off-by-one regression)", () => {
    addStackedBlock(1);
    addStackedBlock(2);
    addStackedBlock(3);
    addStackedBlock(4); // [4, 3, 2, 1]

    moveStackedBlock(4, 2); // move 4 from index 0 to index 2

    expect(roamSidebarState.stackedBlocks.map(b => b.id)).toEqual([3, 4, 2, 1]);
  });
});
