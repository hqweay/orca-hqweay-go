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
import { sessionState, toggleRecording, clearFootprints, addFootprint } from "../utils/state";
import { getFocusedBlock } from "@/libs/navUtils";

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
  // Get the actual block ID from the panels state so it reacts to internal panel navigation
  const activeBlockId = getFocusedBlock(orcaState.panels, activePanelId);
  
  const session = useSnapshot(sessionState);

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
    if (!activeBlockId) return;

    const blockId = activeBlockId;
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

    // Add current block to session if recording
    if (sessionState.isRecording) {
      addFootprint(blockId);
    }

    // Pass the actual footprints (non-proxy array)
    const footprints = Array.from(sessionState.footprints);
    const timeEdges = Array.from(sessionState.timeEdges);

    buildGraph(blockId, footprints, timeEdges, settings).then((result) => {
      if (gen === fetchGenRef.current) {
        setGraphData(result);
        
        // Configure Physics to spread nodes out further
        if (fgRef.current) {
           const fg = fgRef.current;
           // Gentle center force to keep things on screen
           fg.d3Force('center')?.strength(0.05);
           fg.d3Force('charge')?.strength(-120);
           fg.d3Force('link')?.distance(80);
           
           // DO NOT call d3ReheatSimulation()! 
           // That causes the existing nodes to scramble. 
           // We just let the new nodes gently fall into place.
        }
      }
    });
  }, [activeBlockId, pluginId, session.isRecording, session.footprints.length]);

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
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span>Footprint Graph</span>
          <button 
            onClick={toggleRecording}
            style={{
              background: session.isRecording ? "var(--b3-theme-error)" : "var(--b3-theme-surface)",
              color: session.isRecording ? "#fff" : "var(--b3-theme-on-surface)",
              border: "none",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            {session.isRecording ? "■ Stop" : "▶ Start"}
          </button>
          <button 
            onClick={clearFootprints}
            style={{
              background: "transparent",
              color: "var(--b3-theme-on-surface)",
              border: "1px solid var(--b3-theme-surface-lighter)",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Reset
          </button>
        </div>
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
            nodeRelSize={4}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              
              // Draw node circle
              const nodeR = Math.sqrt(node.val || 1) * 4;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color || "var(--b3-theme-primary)";
              ctx.fill();

              // Draw text label
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = "var(--b3-theme-on-background)";
              ctx.fillText(label, node.x, node.y + nodeR + fontSize);
            }}
            onNodeClick={handleNodeClick}
            linkCanvasObject={(link: any, ctx, globalScale) => {
              const start = link.source;
              const end = link.target;

              if (typeof start !== 'object' || typeof end !== 'object') return;

              ctx.beginPath();
              ctx.moveTo(start.x, start.y);
              ctx.lineTo(end.x, end.y);

              if (link.isTimeEdge) {
                ctx.strokeStyle = "var(--b3-theme-primary)";
                ctx.setLineDash([4, 4]); // Dashed line
                ctx.lineWidth = 1.5 / globalScale;
              } else {
                ctx.strokeStyle = "var(--b3-theme-surface-lighter)";
                ctx.setLineDash([]); // Solid line
                ctx.lineWidth = 1 / globalScale;
              }
              
              ctx.stroke();
              // Reset dash
              ctx.setLineDash([]);
            }}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            // Enhance visual appearance
            backgroundColor="transparent"
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.1}
          />
        )}
      </div>
    </div>
  );
};
