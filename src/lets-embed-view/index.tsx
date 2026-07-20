import { BasePlugin } from "../libs/BasePlugin";
import { EmbedViewRenderer } from "./components/EmbedViewRenderer";
import { removeCSSRule } from "@/libs/styleUtil";
import { t } from "@/libs/l10n";

const RENDERER_TYPE = "embed-view";

export default class EmbedViewPlugin extends BasePlugin {
  constructor(mainPluginName: string, name: string) {
    super(mainPluginName, name);
  }

  async load() {
    console.log("[lets-embed-view] load() called");
    if (!orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.registerBlock(RENDERER_TYPE, true, EmbedViewRenderer);
    }

    const fullId = `${this.name}.create-embed`;

    orca.commands.registerEditorCommand(
      fullId,
      async ([_panelId, _rootBlockId, cursor]) => {
        try {
          if (!cursor || !cursor.anchor) return null;
          const currentBlock = orca.state.blocks[cursor.anchor.blockId];
          if (!currentBlock) return null;

          const repr = (currentBlock as any)._repr || {};
          await orca.commands.invokeEditorCommand(
            "core.editor.setProperties",
            null,
            [cursor.anchor.blockId],
            [{ name: "_repr", type: 0, value: { ...repr, type: RENDERER_TYPE, mode: "html", html: "" } }],
          );

          return null;
        } catch (error) {
          console.error("[lets-embed-view] Error:", error);
          return null;
        }
      },
      ([_panelId, _rootBlockId, _cursor]) => {},
      { label: t("embed-view.create-command"), hasArgs: false },
    );

    orca.slashCommands.registerSlashCommand("embed-view-slash", {
      icon: "ti ti-frame",
      group: "Insert",
      title: t("embed-view.create-command"),
      command: fullId,
    });
  }

  async unload() {
    const fullId = `${this.name}.create-embed`;
    orca.commands.unregisterEditorCommand(fullId);
    orca.slashCommands.unregisterSlashCommand("embed-view-slash");
    if (orca.state.blockRenderers[RENDERER_TYPE]) {
      orca.renderers.unregisterBlock(RENDERER_TYPE);
    }
    removeCSSRule(RENDERER_TYPE);
  }
}
