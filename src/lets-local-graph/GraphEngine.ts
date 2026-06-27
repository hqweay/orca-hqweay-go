import { getBlockTitle } from "@/libs/BlockFormatter";
import type { Block } from "../orca";

export interface GraphNode {
  id: number;
  label: string;
  val?: number; // node size
  color?: string;
}

export interface GraphLink {
  source: number;
  target: number;
  label?: string; // alias
  isTimeEdge?: boolean;
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
  settings: GraphEngineSettings,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes = new Map<number, GraphNode>();
  const links: GraphLink[] = [];

  try {
    const excludedSet = new Set(
      settings.excludedTags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    );

    // 1. Gather Node Pool
    const nodePool = new Set<number>();
    
    // Add history footprint nodes
    for (const id of footprints) {
      nodePool.add(id);
    }

    // Add active center block
    if (centerBlockId) {
      nodePool.add(centerBlockId);

      // Fetch center block to get its 1st-degree neighbors
      const centerBlock = (await orca.invokeBackend("get-block", centerBlockId)) as Block;
      if (centerBlock) {
        let degreeCount = 0;
        if (centerBlock.refs) {
          for (const ref of centerBlock.refs) {
            if (degreeCount >= settings.maxDegree) break;
            if (ref.alias && excludedSet.has(ref.alias.toLowerCase())) continue;
            if (ref.to) {
              nodePool.add(ref.to);
              degreeCount++;
            }
          }
        }
        if (centerBlock.backRefs) {
          for (const ref of centerBlock.backRefs) {
            if (degreeCount >= settings.maxDegree) break;
            if (ref.from) {
              nodePool.add(ref.from);
              degreeCount++;
            }
          }
        }
      }
    }

    if (nodePool.size === 0) return { nodes: [], links: [] };

    // Limit node pool size just in case (though it should be small)
    const limitedPool = Array.from(nodePool).slice(0, settings.maxNodes);
    const poolSet = new Set(limitedPool);

    // 2. Fetch all blocks in the pool
    const blockCache = new Map<number, Block>();
    for (const id of limitedPool) {
      const block = (await orca.invokeBackend("get-block", id)) as Block;
      if (block) {
        blockCache.set(id, block);
      }
    }

    // 3. Construct Graph Nodes
    const historySet = new Set(footprints);

    for (const [id, block] of blockCache.entries()) {
      let color = "var(--b3-theme-surface-lighter)"; // default: neighbor
      let val = 1;
      
      if (id === centerBlockId) {
        color = "var(--b3-theme-error)"; // Active Block (prominent)
        val = 3;
      } else if (historySet.has(id)) {
        color = "var(--b3-theme-primary)"; // Footprint
        val = 2;
      }

      nodes.set(id, {
        id,
        label: await getBlockTitle(block, id, 10),
        val,
        color,
      });
    }

    // 4. Construct Edges (Intersection check)
    // We only iterate through the outbound refs of blocks in our pool
    // and see if the target is ALSO in our pool.
    for (const [id, block] of blockCache.entries()) {
      if (!block.refs) continue;
      
      for (const ref of block.refs) {
        if (!ref.to) continue;
        
        // Check blacklist
        if (ref.alias && excludedSet.has(ref.alias.toLowerCase())) continue;
        
        // Edge exists purely within our pool!
        if (poolSet.has(ref.to) && blockCache.has(ref.to)) {
          links.push({
            source: id,
            target: ref.to,
            label: ref.alias,
            isTimeEdge: false,
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
