import { getBlockTitle } from "@/libs/BlockFormatter";
import type { Block } from "../orca";

export interface GraphNode {
  id: number;
  label: string;
  val?: number; // node size
  color?: string; // fallback color
  isLatestNode?: boolean;
  isStartNode?: boolean;
  isFootprint?: boolean;
  isExpanded?: boolean; // Highlight manually expanded nodes
}

export interface GraphLink {
  source: number;
  target: number;
  label?: string; // alias
  isTimeEdge?: boolean;
  isStructural?: boolean;
}

export interface GraphEngineSettings {
  maxDegree: number;
  maxNodes: number;
  excludedTags: string[];
}

export async function buildGraph(
  centerBlockId: number | null,
  footprints: number[],
  timeEdges: { source: number; target: number }[],
  expandedNodes: number[],
  filters: { showTags: boolean; showStructure: boolean; showReferences: boolean },
  settings: GraphEngineSettings,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes = new Map<number, GraphNode>();
  const links: GraphLink[] = [];

  try {
    const excludedSet = new Set(
      settings.excludedTags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    );

    // 1. Gather Footprints & Center Block
    const footprintSet = new Set<number>(footprints);
    if (centerBlockId) footprintSet.add(centerBlockId);

    // 2. Fetch all Footprint Blocks to scan their neighbors
    const footprintBlocks = new Map<number, Block>();
    for (const id of footprintSet) {
      const block = (await orca.invokeBackend("get-block", id)) as Block;
      if (block) footprintBlocks.set(id, block);
    }

    const shouldIncludeRef = (ref: any) => {
      if (ref.alias && excludedSet.has(ref.alias.toLowerCase())) return false;
      if (!filters.showTags && ref.type === 2) return false;
      if (!filters.showReferences && ref.type !== 2) return false;
      return true;
    };

    // 3. Count Neighbor References
    const neighborCounts = new Map<number, number>();
    for (const [id, block] of footprintBlocks.entries()) {
      const uniqueNeighborsForThisBlock = new Set<number>();
      if (block.refs) {
        for (const ref of block.refs) {
          if (shouldIncludeRef(ref) && ref.to) uniqueNeighborsForThisBlock.add(ref.to);
        }
      }
      if (block.backRefs) {
        for (const ref of block.backRefs) {
          if (ref.from) uniqueNeighborsForThisBlock.add(ref.from);
        }
      }
      if (filters.showStructure && block.parent) {
        const parentId = Number(block.parent);
        if (!isNaN(parentId)) {
          uniqueNeighborsForThisBlock.add(parentId);
        }
      }

      for (const neighborId of uniqueNeighborsForThisBlock) {
        if (!footprintSet.has(neighborId)) {
          neighborCounts.set(neighborId, (neighborCounts.get(neighborId) || 0) + 1);
        }
      }
    }

    // 4. Gather Final Node Pool
    const nodePool = new Set<number>(footprintSet);
    expandedNodes.forEach(id => nodePool.add(id));
    
    // 4a. Add Center & Expanded Blocks' Immediate Neighbors (up to maxDegree)
    const activeCenters = new Set<number>();
    if (centerBlockId) activeCenters.add(centerBlockId);
    expandedNodes.forEach(id => activeCenters.add(id));

    for (const centerId of activeCenters) {
      let centerBlock = footprintBlocks.get(centerId);
      if (!centerBlock) {
        centerBlock = (await orca.invokeBackend("get-block", centerId)) as Block;
        if (centerBlock) footprintBlocks.set(centerId, centerBlock);
      }
      
      if (centerBlock) {
        let degreeCount = 0;
        if (centerBlock.refs) {
          for (const ref of centerBlock.refs) {
            if (degreeCount >= settings.maxDegree) break;
            if (shouldIncludeRef(ref) && ref.to && !nodePool.has(ref.to)) {
              nodePool.add(ref.to);
              degreeCount++;
            }
          }
        }
        if (centerBlock.backRefs) {
          for (const ref of centerBlock.backRefs) {
            if (degreeCount >= settings.maxDegree) break;
            if (ref.from && !nodePool.has(ref.from)) {
              nodePool.add(ref.from);
              degreeCount++;
            }
          }
        }
        if (filters.showStructure && centerBlock.parent) {
          const parentId = Number(centerBlock.parent);
          if (!isNaN(parentId) && !nodePool.has(parentId)) {
            nodePool.add(parentId);
          }
        }
      }
    }

    // 4b. Add Gravity Intersection Neighbors (count >= 2, max 50 to prevent bloat)
    let intersectionCount = 0;
    const sortedIntersections = Array.from(neighborCounts.entries())
      .filter(([id, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
      
    for (const [neighborId, count] of sortedIntersections) {
      if (intersectionCount >= 50) break;
      if (!nodePool.has(neighborId)) {
        nodePool.add(neighborId);
        intersectionCount++;
      }
    }

    if (nodePool.size === 0) return { nodes: [], links: [] };

    // Limit node pool size just in case
    const limitedPool = Array.from(nodePool).slice(0, settings.maxNodes);
    const poolSet = new Set(limitedPool);

    // 5. Fetch all blocks in the final pool
    const blockCache = new Map<number, Block>();
    for (const id of limitedPool) {
      if (footprintBlocks.has(id)) {
        blockCache.set(id, footprintBlocks.get(id)!);
      } else {
        const block = (await orca.invokeBackend("get-block", id)) as Block;
        if (block) blockCache.set(id, block);
      }
    }

    // 3. Construct Graph Nodes
    const historySet = new Set(footprints);

    for (const [id, block] of blockCache.entries()) {
      let color = "var(--b3-theme-surface-lighter)"; // default: neighbor
      let val = 1;
      
      const isStartNode = footprints.length > 0 && footprints[0] === id;
      const isLatestNode = id === centerBlockId;

      if (isLatestNode) {
        val = 3;
      } else if (isStartNode) {
        val = 2.5;
      } else if (historySet.has(id)) {
        val = 2;
      }

      nodes.set(id, {
        id,
        label: await getBlockTitle(block, id, 10),
        val,
        isLatestNode,
        isStartNode,
        isFootprint: historySet.has(id),
        isExpanded: expandedNodes.includes(id),
      });
    }

    // 4. Construct Edges (Intersection check)
    // We only iterate through the outbound refs of blocks in our pool
    // and see if the target is ALSO in our pool.
    for (const [id, block] of blockCache.entries()) {
      if (block.refs) {
        for (const ref of block.refs) {
          if (!shouldIncludeRef(ref)) continue;
          
          // Edge exists purely within our pool!
          if (poolSet.has(ref.to) && blockCache.has(ref.to)) {
            links.push({
              source: id,
              target: ref.to,
              label: ref.alias,
              isTimeEdge: false,
              isStructural: false,
            });
          }
        }
      }

      // Add Structural Edges (Parent/Child)
      if (filters.showStructure && block.parent) {
        const parentId = Number(block.parent);
        if (!isNaN(parentId) && poolSet.has(parentId) && blockCache.has(parentId)) {
          links.push({
            source: id,
            target: parentId,
            isTimeEdge: false,
            isStructural: true,
          });
        }
      }
    }

    // 5. Append Time Edges
    for (const edge of timeEdges) {
      if (poolSet.has(edge.source) && poolSet.has(edge.target)) {
        links.push({
          source: edge.source,
          target: edge.target,
          isTimeEdge: true,
        });
      }
    }
  } catch (error) {
    console.error("[GraphEngine] Error building graph:", error);
  }

  return {
    nodes: Array.from(nodes.values()),
    links,
  };
}
