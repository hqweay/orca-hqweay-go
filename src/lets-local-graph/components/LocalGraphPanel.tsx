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
import {
  sessionState,
  toggleRecording,
  addFootprint,
  clearFootprints,
} from "../utils/state";
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

  const [themeColors, setThemeColors] = useState({
    primary: "#3b82f6",
    error: "#ef4444",
    surfaceLighter: "#374151",
    onBackground: "#ffffff"
  });

  const [hoverNode, setHoverNode] = useState<any>(null);
  const [showHelper, setShowHelper] = useState(false);
  const [frozenBlockId, setFrozenBlockId] = useState<number | null>(null);
  const forceResetRef = useRef(false);

  // Freeze Graph Logic: Only track active block if we are recording
  useEffect(() => {
    if (session.isRecording) {
      setFrozenBlockId(activeBlockId);
    }
  }, [activeBlockId, session.isRecording]);

  useEffect(() => {
    // Resolve CSS variables for Canvas compatibility
    const target = containerRef.current || document.body;
    const style = getComputedStyle(target);
    setThemeColors({
      primary: style.getPropertyValue('--b3-theme-primary').trim() || "#3b82f6",
      error: style.getPropertyValue('--b3-theme-error').trim() || "#ef4444",
      surfaceLighter: style.getPropertyValue('--b3-theme-surface-lighter').trim() || "#374151",
      onBackground: style.color || style.getPropertyValue('--b3-theme-on-background').trim() || "#d1d5db"
    });
  }, []);

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
    if (!frozenBlockId) return;

    const blockId = frozenBlockId;
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
        setGraphData(prev => {
          const oldNodesMap = new Map(prev.nodes.map(n => [n.id, n]));
          const isResetting = forceResetRef.current;
          
          const newNodes = result.nodes.map(n => {
            // Anti-shake: preserve physics coords unless we are doing a hard reset
            if (!isResetting && oldNodesMap.has(n.id)) {
              const old = oldNodesMap.get(n.id)!;
              Object.assign(old, n);
              return old;
            }
            return n;
          });
          
          if (isResetting) forceResetRef.current = false;
          return { nodes: newNodes, links: result.links };
        });
        
        // Configure Physics to spread nodes out further
        if (fgRef.current) {
           const fg = fgRef.current;
           // Gentle center force to keep things on screen
           fg.d3Force('center')?.strength(0.02);
           fg.d3Force('charge')?.strength(-100);
           fg.d3Force('link')?.distance(90);
           
           // DO NOT call d3ReheatSimulation()! 
           // That causes the existing nodes to scramble. 
           // We just let the new nodes gently fall into place.
        }
      }
    });
  }, [frozenBlockId, pluginId, session.isRecording, session.footprints.length]);

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
          <div style={{ display: "flex", gap: "4px", position: "relative" }}>
            <span
              className="block__icon"
              onMouseEnter={() => setShowHelper(true)}
              onMouseLeave={() => setShowHelper(false)}
              style={{ cursor: "help", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className="ti ti-help" style={{ fontSize: "14px" }} />
            </span>
            {showHelper && (
              <div
                style={{
                  position: "absolute",
                  left: "100%",
                  top: "0",
                  marginLeft: "8px",
                  backgroundColor: "var(--b3-theme-background, #ffffff)",
                  border: "1px solid var(--b3-theme-surface-lighter)",
                  borderRadius: "6px",
                  padding: "10px",
                  zIndex: 1000,
                  width: "max-content",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  color: "var(--b3-theme-on-background)",
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontWeight: "normal",
                }}
              >
                 <div style={{fontWeight: 600, marginBottom: '2px', color: 'var(--b3-theme-on-background)'}}>Nodes</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.error, fontSize: "10px"}}>🔴</span> Current Block</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#10b981', fontSize: "10px"}}>🟢</span> Start Block</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.primary, fontSize: "10px"}}>🔵</span> Visited Path</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><span style={{fontSize: "10px"}}>⚪</span> Unvisited Neighbor</div>
                 
                 <div style={{fontWeight: 600, marginBottom: '2px', color: 'var(--b3-theme-on-background)'}}>Edges</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.primary, fontWeight: 'bold'}}>--&gt;</span> Traversal Path</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span>───</span> Explicit Reference</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{letterSpacing: "1px"}}>···</span> Parent Structure</div>
              </div>
            )}
            
            <span 
              className="block__icon b3-tooltips b3-tooltips__w"
              aria-label="Restart Session"
              onClick={() => {
                forceResetRef.current = true;
                clearFootprints();
                if (!session.isRecording) toggleRecording(activeBlockId);
                else if (activeBlockId != null) addFootprint(activeBlockId);
                
                // Provide visual feedback for reset
                orca.notify("success", "Footprint Graph Reset");
              }}
              style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className="ti ti-refresh" />
            </span>
            <span 
              className="block__icon b3-tooltips b3-tooltips__w"
              aria-label={session.isRecording ? "Stop Recording" : "Resume Recording"}
              onClick={() => toggleRecording(activeBlockId)}
              style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className={`ti ${session.isRecording ? "ti-player-pause" : "ti-player-play"}`} style={{ color: session.isRecording ? "var(--b3-theme-error)" : "inherit" }} />
            </span>
          </div>
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
              const nodeR = Math.sqrt(node.val || 1) * 3.5;

              // Determine Color
              let color = themeColors.surfaceLighter; // Gray (neighbor)
              if (node.isLatestNode) color = themeColors.error; // Red
              else if (node.isStartNode) color = "#10b981"; // Green
              else if (node.isFootprint) color = themeColors.primary; // Blue

              // Draw Main Node Circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();

              // For Latest and Start nodes, draw a subtle outer glowing ring
              if (node.isLatestNode || node.isStartNode) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeR + 2.5, 0, 2 * Math.PI, false);
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = 1.0;
              }

              // Smart Label Visibility (Roam Research style)
              // 1. Always show if zoomed in close enough
              // 2. Always show if it's an important node (Footprint / Start / Latest)
              // 3. Always show if the mouse is hovering over it
              const isHovered = hoverNode && hoverNode.id === node.id;
              const showText = globalScale >= 1.2 || (node.val && node.val >= 2) || isHovered;

              if (showText) {
                const label = node.label;
                const fontSize = 11 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = themeColors.onBackground;
                ctx.fillText(label, node.x, node.y + nodeR + 4 + fontSize);
              }
            }}
            onNodeHover={(node) => {
              setHoverNode(node);
              if (containerRef.current) {
                containerRef.current.style.cursor = node ? 'pointer' : 'default';
              }
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
                ctx.strokeStyle = themeColors.primary;
                ctx.setLineDash([4, 4]); // Dashed line
                ctx.lineWidth = 1.5 / globalScale;
              } else if (link.isStructural) {
                ctx.strokeStyle = themeColors.surfaceLighter;
                ctx.setLineDash([2, 4]); // Dotted line for structural hierarchy
                ctx.lineWidth = 1 / globalScale;
                ctx.globalAlpha = 0.5; // Make them slightly fainter than explicit refs
              } else {
                ctx.strokeStyle = themeColors.surfaceLighter;
                ctx.setLineDash([]); // Solid line for explicit refs
                ctx.lineWidth = 1 / globalScale;
              }
              
              ctx.stroke();
              // Reset context
              ctx.setLineDash([]);
              ctx.globalAlpha = 1.0;
            }}
            linkDirectionalArrowLength={(link: any) => link.isTimeEdge ? 4 : 0}
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
