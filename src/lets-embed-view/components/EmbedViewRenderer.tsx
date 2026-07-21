import { useSnapshot } from "valtio";
import React, { useMemo } from "react";
import { Block } from "@/orca";

const { BlockShell, BlockChildren } = orca.components;

export const EmbedViewRenderer = (props: any) => {
  const {
    panelId,
    blockId,
    rndId,
    mirrorId,
    blockLevel,
    indentLevel,
    initiallyCollapsed,
    renderingMode,
  } = props;
  const { blocks } = useSnapshot(orca.state);
  const block = blocks[mirrorId ?? blockId];

  const childrenBlocks = useMemo(
    () => (
      <BlockChildren
        block={block as Block}
        panelId={panelId}
        blockLevel={blockLevel}
        indentLevel={indentLevel}
        renderingMode={renderingMode}
      />
    ),
    [block?.children],
  );

  return (
    <BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      mirrorId={mirrorId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      initiallyCollapsed={initiallyCollapsed}
      renderingMode={renderingMode}
      reprClassName="myplugin-repr-image"
      contentClassName="myplugin-repr-image-content"
      contentAttrs={{ contentEditable: false }}
      contentJsx={<div>embed</div>}
      // childrenJsx={childrenBlocks}
    />
  );
};
