import React from "react";
import type { DbId } from "@/orca";

const { Block } = orca.components;

interface TopicRendererProps {
  blockId: DbId;
  panelId: string;
}

/**
 * 阅读型卡片渲染器 (Topic)
 * 逻辑最简化：直接渲染 Block 即可，不需要隐藏子块
 */
export const TopicRenderer: React.FC<TopicRendererProps> = ({
  blockId,
  panelId,
}) => {
  return (
    <div
      className="srs-topic-renderer"
      style={{
        marginLeft: "38px",
      }}
    >
      <Block
        panelId={panelId}
        blockId={blockId}
        blockLevel={0}
        indentLevel={0}
        // renderingMode="normal"
        initiallyCollapsed={false}
      />
    </div>
  );
};
