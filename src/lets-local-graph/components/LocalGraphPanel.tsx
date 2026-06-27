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
  useFootprintSession,
} from "../utils/state";
import { getFocusedBlock } from "@/libs/navUtils";
import type { Block } from "../../orca";
import { createLinkEvaluator } from "../utils/LinkEvaluator";

interface LocalGraphPanelProps {
  panel?: any;
  pluginId: string;
  t: (key: string, args?: { [key: string]: string }) => string;
}

export const LocalGraphPanel: React.FC<LocalGraphPanelProps> = ({
  panel,
  pluginId,
  t,
}) => {
  const orcaState = useSnapshot(orca.state);
  const activePanelId = orcaState.activePanel;
  // Get the actual block ID from the panels state so it reacts to internal panel navigation
  const activeBlockId = getFocusedBlock(orcaState.panels, activePanelId);
  
  const session = useFootprintSession();
  
  // Extract primitives from snapshot to trigger React re-renders on Valtio changes
  const footprintsLength = session.footprints.length;
  const timeEdgesLength = session.timeEdges.length;
  const expandedNodesLength = session.expandedNodes.length;
  const showTags = session.filters.showTags;
  const showStructure = session.filters.showStructure;
  const showReferences = session.filters.showReferences;

  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });

  const latestNodesRef = useRef(graphData.nodes);
  latestNodesRef.current = graphData.nodes;

  const latestFiltersRef = useRef(session.filters);
  latestFiltersRef.current = session.filters;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  
  const playbackIndexRef = useRef(playbackIndex);
  playbackIndexRef.current = playbackIndex;

  const wasRecordingBeforePlaybackRef = useRef(session.isRecording);
  const targetCenterNodeIdRef = useRef<number | null>(null);
  const isTrackingSuspendedRef = useRef(false);

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

  // Viewport tracking logic for playback centering
  const handleEngineTick = useCallback(() => {
    if (playbackIndexRef.current === null || isTrackingSuspendedRef.current) return;
    const targetId = targetCenterNodeIdRef.current;
    if (targetId === null) return;

    const targetNode = latestNodesRef.current.find((n: any) => n.id === targetId);
    if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
      fgRef.current?.centerAt(targetNode.x, targetNode.y, 400);
      targetCenterNodeIdRef.current = null;
    }
  }, []);

  // Playback timer loop
  useEffect(() => {
    if (playbackIndex === null) return;

    const timer = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev === null) return null;
        if (prev >= sessionRef.current.footprints.length - 1) {
          clearInterval(timer);
          orca.notify("success", t("playbackFinished"));
          if (wasRecordingBeforePlaybackRef.current && !sessionRef.current.isRecording) {
            sessionRef.current.toggleRecording(frozenBlockId);
          }
          return null;
        }

        const nextIndex = prev + 1;
        const nextNodeId = sessionRef.current.footprints[nextIndex];
        if (nextNodeId) {
          targetCenterNodeIdRef.current = nextNodeId;
        }
        return nextIndex;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [playbackIndex, frozenBlockId, t]);

  // Freeze Graph Logic: Only track active block if we are recording
  useEffect(() => {
    if (session.isRecording && activeBlockId !== null) {
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

  // Pure, parametric rebuild logic
  const doRebuild = useCallback((
    blockId: number,
    footprints: number[],
    timeEdges: { source: number; target: number }[],
    expandedNodes: number[],
    filters: { showTags: boolean; showStructure: boolean; showReferences: boolean }
  ) => {
    const gen = ++fetchGenRef.current;

    let settings: GraphEngineSettings = {
      maxDegree: 40,
      maxNodes: 300,
      excludedTags: ["#Journal", "#TODO"],
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

    buildGraph(blockId, footprints, timeEdges, expandedNodes, filters, settings).then((result) => {
      if (gen === fetchGenRef.current) {
        setGraphData(prev => {
          const oldNodesMap = new Map(prev.nodes.map(n => [n.id, n]));
          const isResetting = forceResetRef.current;
          
          const newNodes = result.nodes.map(n => {
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
        
        if (fgRef.current) {
           const fg = fgRef.current;
           fg.d3Force('center')?.strength(0.02);
           fg.d3Force('charge')?.strength(-100);
           fg.d3Force('link')?.distance(90);
        }
      }
    });
  }, [pluginId]);

  // 1. Footprint recording on navigation (Isolated mutation)
  useEffect(() => {
    if (!frozenBlockId) return;
    if (session.isRecording) {
      session.recordVisit(frozenBlockId);
    }
  }, [frozenBlockId, session.isRecording]);

  // 2. Pure React Effect to rebuild the graph whenever primitive dependencies change or during playback
  useEffect(() => {
    const targetBlockId = playbackIndex !== null && session.footprints.length > 0
      ? session.footprints[Math.min(playbackIndex, session.footprints.length - 1)]
      : frozenBlockId;

    if (!targetBlockId) return;

    const playbackActive = playbackIndex !== null;
    const footprints = playbackActive
      ? Array.from(session.footprints).slice(0, playbackIndex + 1)
      : Array.from(session.footprints);

    const footprintSet = new Set(footprints);
    const timeEdges = Array.from(session.timeEdges).filter(
      (edge) => footprintSet.has(edge.source) && footprintSet.has(edge.target)
    );

    const expandedNodes = playbackActive ? [] : Array.from(session.expandedNodes);

    const filters = {
      showTags,
      showStructure,
      showReferences,
    };

    doRebuild(targetBlockId, footprints, timeEdges, expandedNodes, filters);
  }, [
    frozenBlockId,
    playbackIndex,
    footprintsLength,
    timeEdgesLength,
    expandedNodesLength,
    showTags,
    showStructure,
    showReferences,
    doRebuild
  ]);

  const handleNodeClick = useCallback((node: any) => {
    const blockId = (node as GraphNode).id;
    orca.nav.goTo("block", { blockId });
  }, []);

  const handleNodeRightClick = useCallback(async (node: any) => {
    const blockId = (node as GraphNode).id;
    if (sessionRef.current.expandedNodes.includes(blockId)) {
      sessionRef.current.toggleNodeExpanded(blockId);
      orca.notify("info", t("collapsedNotify", { label: node.label }));
      return;
    }

    const block = await orca.invokeBackend("get-block", blockId) as Block;
    if (!block) return;

    const currentSettings = localGraphPluginInstance?.getSettings();
    const excludedTags = currentSettings?.excludedTags ? currentSettings.excludedTags.split(",") : ["#Journal", "#TODO"];

    // Use latestFiltersRef to avoid async snapshot closure issues
    const shouldIncludeRef = createLinkEvaluator(
      {
        showTags: latestFiltersRef.current.showTags,
        showReferences: latestFiltersRef.current.showReferences,
      },
      excludedTags
    );

    const neighborIds = new Set<number>();
    if (block.refs) {
      for (const ref of block.refs) {
        if (shouldIncludeRef(ref) && ref.to) neighborIds.add(ref.to);
      }
    }
    if (block.backRefs) {
      for (const ref of block.backRefs) {
        if (shouldIncludeRef(ref) && ref.from) neighborIds.add(ref.from);
      }
    }
    if (latestFiltersRef.current.showStructure && block.parent) {
      const parentId = Number(block.parent);
      if (!isNaN(parentId)) neighborIds.add(parentId);
    }

    // Read from latest nodes ref to guarantee latest state after await
    const currentIds = new Set(latestNodesRef.current.map(n => n.id));
    let hasNewNeighbors = false;
    for (const id of neighborIds) {
      if (!currentIds.has(id)) {
        hasNewNeighbors = true;
        break;
      }
    }

    if (!hasNewNeighbors) {
      orca.notify("info", t("noNewNeighbors", { label: node.label }));
      return;
    }

    sessionRef.current.toggleNodeExpanded(blockId);
    orca.notify("success", t("expandedNotify", { label: node.label }));
  }, [t]);

  const ContextMenu = orca.components.ContextMenu;
  const Menu = orca.components.Menu;
  const MenuTitle = orca.components.MenuTitle;
  const MenuText = orca.components.MenuText;

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
          <span>{playbackIndex !== null ? t("playbackProgress", { current: String(playbackIndex + 1), total: String(session.footprints.length) }) : t("graphTitle")}</span>
          <div style={{ display: "flex", gap: "4px", position: "relative" }}>
            <ContextMenu
              placement="vertical"
              alignment="right"
              defaultPlacement="bottom"
              menu={(closeMenu) => (
                <Menu>
                  <MenuTitle title={t("filters")} />
                  <MenuText
                    title={t("filterTags")}
                    preIcon={session.filters.showTags ? "ti ti-checkbox" : "ti ti-square"}
                    onClick={() => {
                      session.toggleFilter("showTags");
                    }}
                  />
                  <MenuText
                    title={t("filterStructure")}
                    preIcon={session.filters.showStructure ? "ti ti-checkbox" : "ti ti-square"}
                    onClick={() => {
                      session.toggleFilter("showStructure");
                    }}
                  />
                  <MenuText
                    title={t("filterReferences")}
                    preIcon={session.filters.showReferences ? "ti ti-checkbox" : "ti ti-square"}
                    onClick={() => {
                      session.toggleFilter("showReferences");
                    }}
                  />
                </Menu>
              )}
            >
              {(open) => (
                <span
                  className="block__icon b3-tooltips b3-tooltips__w"
                  aria-label={t("filterGraph")}
                  onClick={open}
                  style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
                >
                  <i className="ti ti-filter" style={{ fontSize: "14px" }} />
                </span>
              )}
            </ContextMenu>
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
                 <div style={{fontWeight: 600, marginBottom: '2px', color: 'var(--b3-theme-on-background)'}}>{t("nodeHeader")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.error, fontSize: "10px"}}>🔴</span> {t("nodeCurrent")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#10b981', fontSize: "10px"}}>🟢</span> {t("nodeStart")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.primary, fontSize: "10px"}}>🔵</span> {t("nodeVisited")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><span style={{fontSize: "10px"}}>⚪</span> {t("nodeNeighbor")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}><span style={{color: '#06b6d4', fontSize: "10px"}}>🔵</span> {t("nodeExpanded")}</div>
                 
                 <div style={{fontWeight: 600, marginBottom: '2px', color: 'var(--b3-theme-on-background)'}}>{t("edgeHeader")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: themeColors.primary, fontWeight: 'bold'}}>--&gt;</span> {t("edgeTraversal")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span>───</span> {t("edgeReference")}</div>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{letterSpacing: "1px"}}>···</span> {t("edgeStructure")}</div>
              </div>
            )}
            
            <span 
              className="block__icon b3-tooltips b3-tooltips__w"
              aria-label={t("restartSession")}
              onClick={() => {
                forceResetRef.current = true;
                session.clear();
                if (!session.isRecording) session.toggleRecording(activeBlockId);
                else if (activeBlockId != null) session.recordVisit(activeBlockId);
                orca.notify("success", t("resetNotify"));
              }}
              style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className="ti ti-refresh" />
            </span>
            <span 
              className="block__icon b3-tooltips b3-tooltips__w"
              aria-label={playbackIndex !== null ? t("playbackFinished") : t("startPlayback")}
              onClick={() => {
                if (playbackIndex !== null) {
                  setPlaybackIndex(null);
                  if (wasRecordingBeforePlaybackRef.current && !session.isRecording) {
                    session.toggleRecording(activeBlockId);
                  }
                  orca.notify("info", t("playbackFinished"));
                } else {
                  if (session.footprints.length === 0) {
                    orca.notify("info", t("noHistory"));
                    return;
                  }
                  wasRecordingBeforePlaybackRef.current = session.isRecording;
                  if (session.isRecording) {
                    session.toggleRecording(activeBlockId);
                  }
                  setPlaybackIndex(0);
                  targetCenterNodeIdRef.current = session.footprints[0];
                  isTrackingSuspendedRef.current = false;
                }
              }}
              style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className={`ti ${playbackIndex !== null ? "ti-player-stop" : "ti-slideshow"}`} style={{ color: playbackIndex !== null ? "var(--b3-theme-primary)" : "inherit" }} />
            </span>
            <span 
              className="block__icon b3-tooltips b3-tooltips__w"
              aria-label={session.isRecording ? t("stopRecording") : t("resumeRecording")}
              onClick={() => session.toggleRecording(activeBlockId)}
              style={{ cursor: "pointer", display: "inline-flex", padding: "4px", borderRadius: "4px" }}
            >
              <i className={`ti ${session.isRecording ? "ti-player-pause" : "ti-player-play"}`} style={{ color: session.isRecording ? "var(--b3-theme-error)" : "inherit" }} />
            </span>
          </div>
        </div>
        <span style={{ color: "var(--b3-theme-on-surface-light)" }}>
          {t("nodesCount", { count: String(graphData.nodes.length) })}
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
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeDragEnd={(node) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
            onEngineTick={handleEngineTick}
            onZoom={() => {
              if (playbackIndex !== null) {
                isTrackingSuspendedRef.current = true;
              }
            }}
            onNodeDrag={() => {
              if (playbackIndex !== null) {
                isTrackingSuspendedRef.current = true;
              }
            }}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const nodeR = Math.sqrt(node.val || 1) * 3.5;

              // Determine Color
              let color = themeColors.surfaceLighter; // Gray (neighbor)
              if (node.isLatestNode) color = themeColors.error; // Red
              else if (node.isStartNode) color = "#10b981"; // Green
              else if (node.isFootprint) color = themeColors.primary; // Blue

              if ((node as GraphNode).isLatestNode) {
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, nodeR + 4 / globalScale, 0, 2 * Math.PI, false);
                ctx.fillStyle = themeColors.error;
                ctx.globalAlpha = 0.2;
                ctx.fill();
                ctx.globalAlpha = 1;
              } else if ((node as GraphNode).isStartNode) {
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, nodeR + 4 / globalScale, 0, 2 * Math.PI, false);
                ctx.fillStyle = '#10b981';
                ctx.globalAlpha = 0.2;
                ctx.fill();
                ctx.globalAlpha = 1;
              }

              // Outline for manually expanded nodes
              if ((node as GraphNode).isExpanded) {
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, nodeR + 1.5 / globalScale, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#06b6d4'; // Cyan
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              ctx.beginPath();
              ctx.arc(node.x!, node.y!, nodeR, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();

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
            d3AlphaDecay={0.08}
            d3VelocityDecay={0.38}
          />
        )}
      </div>
    </div>
  );
};
