import React, { useEffect, useState, useRef, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useSnapshot } from "valtio";
import {
  buildGraph,
  GraphNode,
  GraphLink,
  GraphEngineSettings,
} from "../GraphEngine";
import { localGraphPluginInstance } from "../index";

interface LocalGraphPanelProps {
  panel?: any;
  pluginId: string;
}

export const LocalGraphPanel: React.FC<LocalGraphPanelProps> = ({
  panel,
  pluginId,
}) => {
  const orcaState = useSnapshot(orca.state);
  const activePanelId = orcaState.activePanel;

  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });

  const fetchGenRef = useRef(0);
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Fetch Graph Data safely with race condition prevention
  useEffect(() => {
    const mainPanel = orca.nav.findViewPanel(activePanelId, orca.state.panels);
    if (mainPanel?.view !== "block") {
      // Not a block view, don't update graph.
      return;
    }

    const blockId = mainPanel.viewArgs?.blockId;
    if (!blockId) return;

    const gen = ++fetchGenRef.current;

    // Get settings safely
    let settings: GraphEngineSettings = {
      maxDegree: 40,
      maxNodes: 300,
      excludedTags: ["#Journal", "#TODO"], // Safe defaults
    };

    const actualPlugin = localGraphPluginInstance;
    if (actualPlugin) {
      const pSettings = actualPlugin.getSettings();
      settings = {
        maxDegree: pSettings.maxDegree ?? 40,
        maxNodes: pSettings.maxNodes ?? 300,
        excludedTags: pSettings.excludedTags
          ? pSettings.excludedTags.split(",")
          : ["#Journal", "#TODO"],
      };
    }

    buildGraph(blockId, settings).then((result) => {
      if (gen === fetchGenRef.current) {
        setGraphData(result);
        
        // Auto-center graph when data updates
        if (fgRef.current) {
           fgRef.current.d3ReheatSimulation();
           setTimeout(() => {
             fgRef.current?.zoomToFit(400, 20);
           }, 100);
        }
      }
    });
  }, [activePanelId, pluginId]);

  const handleNodeClick = useCallback((node: any) => {
    const blockId = (node as GraphNode).id;
    // Wandering: sync editor focus to this block
    orca.nav.goTo("block", { blockId });
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--b3-theme-background)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--b3-theme-surface-lighter)",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--b3-theme-on-background)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Local Graph</span>
        <span style={{ color: "var(--b3-theme-on-surface-light)" }}>
          {graphData.nodes.length} nodes
        </span>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeId="id"
            nodeLabel="label"
            nodeColor={(node: any) =>
              node.color || "var(--b3-theme-primary)"
            }
            nodeVal={(node: any) => node.val || 1}
            onNodeClick={handleNodeClick}
            linkColor={() => "var(--b3-theme-surface-lighter)"}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            // Enhance visual appearance
            backgroundColor="transparent"
            nodeRelSize={4}
          />
        )}
      </div>
    </div>
  );
};
