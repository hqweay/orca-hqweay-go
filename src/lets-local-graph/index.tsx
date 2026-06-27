import React from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { LocalGraphPanel } from "./components/LocalGraphPanel";
import { LocalGraphSettings } from "./settings";

const DEFAULT_SETTINGS = {
  maxDegree: 40,
  maxNodes: 300,
  excludedTags: "#Journal, #TODO",
};

export let localGraphPluginInstance: LocalGraphPlugin | null = null;

export default class LocalGraphPlugin extends BasePlugin {
  constructor(orca: any, initSettings?: any) {
    super(orca, initSettings);
    localGraphPluginInstance = this;
    this.headbarButtonId = "localGraph-headbar-btn";
  }
  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    const onClick = () => {
      const activePanelId = orca.state.activePanel;
      if (activePanelId) {
        orca.nav.addTo(activePanelId, "right", {
          view: "localGraph",
          viewArgs: {},
          viewState: {},
          locked: true,
        } as any);
      } else {
        console.warn("No active panel to add localGraph to.");
      }
    };
    return (
      <Button variant="plain" title={this.t("description")} onClick={onClick}>
        <i className="ti ti-network" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  public async load(): Promise<void> {
    // Register Sidebar Panel
    orca.panels.registerPanel("localGraph", (props: any) => {
      return (
        <LocalGraphPanel
          pluginId={this.name}
          panel={props.panel}
          t={this.t.bind(this)}
        />
      );
    });

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.panels.unregisterPanel("localGraph");
    this.logger.info(`${this.name} unloaded.`);
  }

  public getDefaultSettings(): any {
    return DEFAULT_SETTINGS;
  }

  public renderCustomSettings(
    settings: any,
    updateSettings: (key: string, value: any) => void,
  ): React.ReactNode {
    return (
      <LocalGraphSettings
        settings={settings}
        updateSettings={updateSettings}
        t={this.t.bind(this)}
      />
    );
  }
}
