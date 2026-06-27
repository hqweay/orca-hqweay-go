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
}

export interface GraphEngineSettings {
  maxDegree: number;
  maxNodes: number;
  excludedTags: string[];
}

export async function buildGraph(
  centerBlockId: number,
  settings: GraphEngineSettings,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes = new Map<number, GraphNode>();
  const links: GraphLink[] = [];

  try {
    // 1. Fetch the center block reliably from the backend to ensure backRefs are populated
    const centerBlock = (await orca.invokeBackend(
      "get-block",
      centerBlockId,
    )) as Block;

    if (!centerBlock) {
      return { nodes: [], links: [] };
    }

    // Add center node
    nodes.set(centerBlockId, {
      id: centerBlockId,
      label: await getBlockTitle(centerBlock, centerBlockId, 20),
      val: 3, // Slightly larger center node
      color: "#10b981", // Emerald 500
    });

    const excludedSet = new Set(
      settings.excludedTags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    );

    let currentNodesCount = 1; // Center node
    let outDegree = 0;
    let inDegree = 0;

    // 2. Process Outbound Refs
    if (centerBlock.refs) {
      for (const ref of centerBlock.refs) {
        if (currentNodesCount >= settings.maxNodes) break;
        if (outDegree >= settings.maxDegree) break;

        // Apply Blacklist
        if (ref.alias && excludedSet.has(ref.alias.toLowerCase())) {
          continue;
        }

        const targetId = ref.to;
        if (!targetId) continue;

        // Only add if not already processing
        if (!nodes.has(targetId)) {
          const targetBlock = (await orca.invokeBackend(
            "get-block",
            targetId,
          )) as Block;
          if (targetBlock) {
            nodes.set(targetId, {
              id: targetId,
              label: await getBlockTitle(targetBlock, targetId, 20),
              val: 1,
              color: "#64748b", // Slate 500
            });
            currentNodesCount++;
          }
        }

        links.push({
          source: centerBlockId,
          target: targetId,
          label: ref.alias,
        });
        outDegree++;
      }
    }

    // 3. Process Inbound BackRefs
    if (centerBlock.backRefs) {
      for (const backRef of centerBlock.backRefs) {
        if (currentNodesCount >= settings.maxNodes) break;
        if (inDegree >= settings.maxDegree) break;

        // MVP: We do NOT deep-fetch source blocks to check excluded tags here to avoid N+1 queries.
        const sourceId = backRef.from;
        if (!sourceId) continue;

        if (!nodes.has(sourceId)) {
          const sourceBlock = (await orca.invokeBackend(
            "get-block",
            sourceId,
          )) as Block;
          if (sourceBlock) {
            nodes.set(sourceId, {
              id: sourceId,
              label: await getBlockTitle(sourceBlock, sourceId, 20),
              val: 1,
              color: "#64748b",
            });
            currentNodesCount++;
          }
        }

        links.push({
          source: sourceId,
          target: centerBlockId,
          label: backRef.alias,
        });
        inDegree++;
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
