import React, { useState, useEffect } from "react";
import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import { ensureInbox, ensureBlockInState } from "@/libs/utils";
import { PropType } from "@/libs/consts";
import { DataImporter } from "@/libs/DataImporter";
import type { Block, DbId } from "../orca";
import zhCN from "@/translations/zhCN";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";

const DEFAULT_SETTINGS = {
  syncReminders: true,
  syncCalendar: true,
  reminderLists: "",
  calendarNames: "",
  calendarRange: "today",
  reminderInboxName: "macOS Reminders",
  calendarInboxName: "macOS Calendar",
  autoSyncInterval: 30,
  headbarMode: "both",
};

export default class MacSyncPlugin extends BasePlugin {
  protected headbarButtonId = "lets-mac-sync.headbar-btn";
  protected settingsComponent = MacSyncSettings;
  private syncTimer: any = null;

  public async load(): Promise<void> {
    setupL10N(orca.state.locale, { "zh-CN": zhCN });

    // Register primary manual sync command
    if (orca.state.commands[`${this.name}.sync`] == null) {
      orca.commands.registerCommand(
        `${this.name}.sync`,
        async () => {
          await this.sync();
        },
        t("Sync macOS")
      );
    }

    // Initialize auto sync background timer
    this.setupSyncTimer();
    this.logger.info(`${this.name} loaded successfully.`);
  }

  public async unload(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    orca.commands.unregisterCommand(`${this.name}.sync`);
    this.logger.info(`${this.name} unloaded successfully.`);
  }

  public getDefaultSettings(): any {
    return DEFAULT_SETTINGS;
  }

  public getHeadbarMenuItems(closeMenu: () => void): React.ReactNode[] {
    const MenuText = orca.components.MenuText;
    return [
      React.createElement(MenuText, {
        preIcon: "ti ti-brand-apple",
        key: "mac-sync",
        title: t("Sync macOS"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand(`${this.name}.sync`);
        },
      }),
    ];
  }

  public renderHeadbarButton(): React.ReactNode {
    const Button = orca.components.Button;
    if (!Button) return null;
    return (
      <Button
        variant="plain"
        title={t("Sync macOS")}
        onClick={async () => {
          await this.sync();
        }}
      >
        <i className="ti ti-brand-apple" style={{ fontSize: "16px" }} />
      </Button>
    );
  }

  protected async onConfigChanged(newConfig: any): Promise<void> {
    super.onConfigChanged(newConfig);
    this.setupSyncTimer();
  }

  private setupSyncTimer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    const settings = this.getSettings();
    const interval = parseFloat(settings.autoSyncInterval);

    if (interval > 0) {
      this.logger.info(`Setting up auto sync every ${interval} minutes.`);
      this.syncTimer = setInterval(() => {
        this.sync().catch((err) => {
          this.logger.error("Auto sync failed", err);
        });
      }, interval * 60 * 1000);
    }
  }

  /**
   * Fetch data from local companion server
   */
  private async fetchFromServer(path: string, method: string = "GET", body: any = null): Promise<any> {
    const url = `http://localhost:9090${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      return await response.json();
    } catch (err: any) {
      throw new Error(
        `无法连接到 macOS 同步助手。请确保您已在终端中运行了本地助手服务：\nnode src/lets-mac-sync/sync-server.js\n(错误详情: ${err.message})`
      );
    }
  }

  /**
   * Main sync routine
   */
  public async sync(): Promise<void> {
    const settings = this.getSettings();
    orca.notify("info", t("Syncing macOS data, please wait..."));
    this.logger.info("Starting macOS sync...");

    try {
      if (settings.syncReminders) {
        await this.syncReminders();
      }
      if (settings.syncCalendar) {
        await this.syncCalendar();
      }
      orca.notify("success", t("macOS data synced successfully."));
    } catch (err: any) {
      this.logger.error("MAC SYNC ERROR:", err);
      orca.notify("error", `${t("Failed to sync macOS data.")} ${err.message || ""}`);
    }
  }

  /**
   * Reminders Synchronization Flow
   */
  private async syncReminders(): Promise<void> {
    const settings = this.getSettings();
    const listFilterRaw = settings.reminderLists || "";
    const filterArray = listFilterRaw
      ? listFilterRaw
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    const listsFilterString = filterArray.map((s: string) => `"${s}"`).join(", ");

    // 1. Fetch uncompleted and recently completed reminders from local macOS Companion Server
    const reminders = await this.fetchFromServer(
      `/reminders?lists=${encodeURIComponent(listFilterRaw)}`
    );
    if (!Array.isArray(reminders)) {
      this.logger.warn("No reminders fetched or JXA returned empty.");
      return;
    }

    const reminderTag = "AppleReminder";
    const inboxName = settings.reminderInboxName || "macOS Reminders";

    // 2. Query all existing synced reminders from Orca DB (using unique UUID property)
    const syncedReminderIds = (await orca.invokeBackend("query", {
      q: {
        kind: 100, // QueryKindSelfAnd
        conditions: [
          {
            kind: 4, // QueryKindTag
            name: reminderTag,
            selfOnly: true,
          },
        ],
      },
      pageSize: 5000,
    })) as DbId[];

    const localReminders: Record<string, { block: Block; status: string }> = {};
    for (const bId of syncedReminderIds) {
      const block = await ensureBlockInState(bId);
      if (block) {
        const ref = block.refs?.find((r) => r.alias === reminderTag);
        if (ref && ref.data) {
          const idProp = ref.data.find((p) => p.name === "ID");
          const statusProp = ref.data.find((p) => p.name === "Status");
          if (idProp && idProp.value) {
            const isCompletedInText = block.text?.startsWith("[x] ");
            let statusVal = "Pending";
            if (
              statusProp &&
              Array.isArray(statusProp.value) &&
              statusProp.value.includes("Completed")
            ) {
              statusVal = "Completed";
            } else if (isCompletedInText) {
              statusVal = "Completed";
            }
            localReminders[idProp.value] = { block, status: statusVal };
          }
        }
      }
    }

    // 3. Two-Way completion sync: Complete reminders in macOS if completed in Orca Note
    for (const rem of reminders) {
      const local = localReminders[rem.id];
      if (local && local.status === "Completed" && !rem.completed) {
        try {
          await this.fetchFromServer("/reminders/complete", "POST", { id: rem.id });
          this.logger.info(`Two-way Sync: Completed reminder on macOS: ${rem.name}`);
          rem.completed = true; // Mutate to completed for downstream rendering
        } catch (e) {
          this.logger.error(`Failed to update macOS completion status for reminder: ${rem.id}`, e);
        }
      }
    }

    // 4. Inbound Processing with Dynamic Roll-Forward
    const today = new Date();

    await orca.commands.invokeGroup(async () => {
      for (const rem of reminders) {
        let targetDate: Date;
        let isUnscheduledAndActive = false;

        if (rem.dueDate) {
          targetDate = new Date(rem.dueDate);
        } else {
          if (rem.completed) {
            targetDate = rem.completionDate ? new Date(rem.completionDate) : today;
          } else {
            // Uncompleted reminder with NO due date: Sync/Move directly to TODAY
            targetDate = today;
            isUnscheduledAndActive = true;
          }
        }

        const journalBlock = await orca.invokeBackend("get-journal-block", targetDate);
        if (!journalBlock) continue;

        const inbox = await ensureInbox(journalBlock, inboxName);
        const local = localReminders[rem.id];

        // Format clean visual representation: [ ] or [x] + Title + Body description
        const statusPrefix = rem.completed ? "[x] " : "[ ] ";
        const cleanTitle = rem.name.trim();
        const bodySuffix = rem.body.trim() ? `\n${rem.body.trim()}` : "";
        const textVal = `${statusPrefix}${cleanTitle}${bodySuffix}`;

        let reminderBlockId: DbId;

        if (local) {
          reminderBlockId = local.block.id;

          // DYNAMIC ROLL-FORWARD: Relocate incomplete, unscheduled tasks to today's inbox block
          if (isUnscheduledAndActive && local.block.parent !== inbox.id) {
            this.logger.info(
              `Rolling forward incomplete reminder block ${reminderBlockId} ("${cleanTitle}") to today's Daily Journal.`
            );
            await orca.commands.invokeEditorCommand(
              "core.editor.moveBlocks",
              null,
              [reminderBlockId],
              inbox.id,
              "lastChild"
            );
          }

          // Update text description if changed
          if (local.block.text !== textVal) {
            await orca.commands.invokeEditorCommand(
              "core.editor.setBlocksContent",
              null,
              [
                {
                  id: reminderBlockId,
                  content: [{ t: "t", v: textVal }],
                },
              ]
            );
          }
        } else {
          // Sync fresh reminder block
          reminderBlockId = await orca.commands.invokeEditorCommand(
            "core.editor.insertBlock",
            null,
            inbox,
            "lastChild",
            [{ t: "t", v: textVal }],
            { type: "text" }
          );
        }

        // Form tag properties & choices
        const priorityStr =
          rem.priority === 1
            ? "High"
            : rem.priority === 5
              ? "Medium"
              : rem.priority === 9
                ? "Low"
                : "None";
        const statusStr = rem.completed ? "Completed" : "Pending";

        const tagProps: any[] = [
          { name: "ID", type: PropType.Text, value: rem.id },
          { name: "List", type: PropType.TextChoices, value: [rem.list] },
          { name: "Priority", type: PropType.TextChoices, value: [priorityStr] },
          { name: "Status", type: PropType.TextChoices, value: [statusStr] },
        ];
        if (rem.dueDate) {
          tagProps.push({
            name: "Due",
            type: PropType.DateTime,
            value: new Date(rem.dueDate),
          });
        }

        // Apply metadata and sync choices schema
        await DataImporter.applyTag(reminderBlockId, {
          name: reminderTag,
          properties: tagProps,
        });

        // Set as long form if description has newlines
        if (bodySuffix.includes("\n")) {
          const repr = local
            ? local.block.properties?.find((p) => p.name === "_repr")?.value
            : null;
          if (!repr || repr.showAsLongForm !== true) {
            await orca.commands.invokeEditorCommand(
              "core.editor.toggleShowAsLongForm",
              null,
              reminderBlockId
            );
          }
        }
      }
    });
  }

  /**
   * Calendar Synchronization Flow
   */
  private async syncCalendar(): Promise<void> {
    const settings = this.getSettings();
    const calFilterRaw = settings.calendarNames || "";
    const filterArray = calFilterRaw
      ? calFilterRaw
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    const calFilterString = filterArray.map((s: string) => `"${s}"`).join(", ");

    // Determine query date range
    const range = settings.calendarRange || "today";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (range === "today_tomorrow") {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    } else if (range === "week") {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 23, 59, 59);
    }

    // 1. Fetch calendar events from local macOS Companion Server
    const events = await this.fetchFromServer(
      `/calendar?calendars=${encodeURIComponent(calFilterRaw)}&range=${range}`
    );
    if (!Array.isArray(events)) {
      this.logger.warn("No calendar events fetched or JXA returned empty.");
      return;
    }

    const calendarTag = "AppleCalendar";
    const inboxName = settings.calendarInboxName || "macOS Calendar";

    // Query existing calendar blocks in Orca DB
    const syncedCalIds = (await orca.invokeBackend("query", {
      q: {
        kind: 100, // QueryKindSelfAnd
        conditions: [
          {
            kind: 4, // QueryKindTag
            name: calendarTag,
            selfOnly: true,
          },
        ],
      },
      pageSize: 5000,
    })) as DbId[];

    const localCalendar: Record<string, Block> = {};
    for (const bId of syncedCalIds) {
      const block = await ensureBlockInState(bId);
      if (block) {
        const ref = block.refs?.find((r) => r.alias === calendarTag);
        if (ref && ref.data) {
          const idProp = ref.data.find((p) => p.name === "ID");
          if (idProp && idProp.value) {
            localCalendar[idProp.value] = block;
          }
        }
      }
    }

    // Inbound processing
    await orca.commands.invokeGroup(async () => {
      for (const ev of events) {
        const startDate = new Date(ev.startDate);
        const endDate = ev.endDate ? new Date(ev.endDate) : null;

        const journalBlock = await orca.invokeBackend("get-journal-block", startDate);
        if (!journalBlock) continue;

        const inbox = await ensureInbox(journalBlock, inboxName);
        const localBlock = localCalendar[ev.id];

        // Format calendar block title: Time slot + Summary
        const formatTime = (d: Date) => {
          const h = String(d.getHours()).padStart(2, "0");
          const m = String(d.getMinutes()).padStart(2, "0");
          return `${h}:${m}`;
        };

        const timeStr = endDate
          ? `${formatTime(startDate)} - ${formatTime(endDate)}`
          : `${formatTime(startDate)}`;
        const textVal = `${timeStr} ${ev.title.trim()}`;

        let calBlockId: DbId;
        if (localBlock) {
          calBlockId = localBlock.id;

          if (localBlock.text !== textVal) {
            await orca.commands.invokeEditorCommand(
              "core.editor.setBlocksContent",
              null,
              [
                {
                  id: calBlockId,
                  content: [{ t: "t", v: textVal }],
                },
              ]
            );
          }
        } else {
          calBlockId = await orca.commands.invokeEditorCommand(
            "core.editor.insertBlock",
            null,
            inbox,
            "lastChild",
            [{ t: "t", v: textVal }],
            { type: "text" }
          );
        }

        // Apply metadata properties & TextChoices choices
        const tagProps: any[] = [
          { name: "ID", type: PropType.Text, value: ev.id },
          {
            name: "Calendar",
            type: PropType.TextChoices,
            value: [ev.calendar],
          },
          { name: "Start", type: PropType.DateTime, value: startDate },
        ];
        if (endDate) {
          tagProps.push({
            name: "End",
            type: PropType.DateTime,
            value: endDate,
          });
        }
        if (ev.location) {
          tagProps.push({
            name: "Location",
            type: PropType.Text,
            value: ev.location,
          });
        }

        await DataImporter.applyTag(calBlockId, {
          name: calendarTag,
          properties: tagProps,
        });

        // Insert description note as child block if present
        if (ev.description && ev.description.trim()) {
          const hasDescriptionBlock = localBlock && localBlock.children.length > 0;
          if (!hasDescriptionBlock) {
            const repr = localBlock
              ? localBlock.properties?.find((p) => p.name === "_repr")?.value
              : null;
            if (!repr || repr.showAsLongForm !== true) {
              await orca.commands.invokeEditorCommand(
                "core.editor.toggleShowAsLongForm",
                null,
                calBlockId
              );
            }
            await orca.commands.invokeEditorCommand(
              "core.editor.insertBlock",
              null,
              calBlockId,
              "firstChild",
              [{ t: "t", v: ev.description.trim() }],
              { type: "text" }
            );
          }
        }
      }
    });
  }
}

/**
 * Settings UI Dashboard Component
 */
function MacSyncSettings({ plugin }: { plugin: MacSyncPlugin }) {
  const settings = plugin.getSettings();
  const [config, setConfig] = useState(settings);

  const updateConfig = async (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    await plugin.updateSettings(newConfig);
  };

  const Input = orca.components.Input;
  const Checkbox = orca.components.Checkbox;
  const Select = orca.components.Select;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SettingsSection title={t("macOS Sync Settings")}>
        {/* Sync Reminders Switch */}
        <SettingsItem
          label={t("Sync macOS Reminders")}
          description={t(
            "Enable synchronization of reminders from macOS Reminders app."
          )}
        >
          <div style={{ display: "flex", alignItems: "center", height: "32px" }}>
            <Checkbox
              checked={!!config.syncReminders}
              onChange={({ checked }) => updateConfig("syncReminders", checked)}
            />
          </div>
        </SettingsItem>

        {config.syncReminders && (
          <React.Fragment>
            {/* Reminder Lists Filter */}
            <SettingsItem
              label={t("Reminder Lists (comma separated)")}
              vertical
              description={t(
                "Comma-separated list of reminder list names to sync. Leave empty to sync all."
              )}
            >
              <Input
                value={config.reminderLists || ""}
                onChange={(e: any) => updateConfig("reminderLists", e.target.value)}
                placeholder="e.g. Personal, Work, Shopping"
              />
            </SettingsItem>

            {/* Reminder Inbox Title Heading */}
            <SettingsItem
              label={t("Reminder Inbox Heading")}
              vertical
              description={t(
                "The heading text in Daily Journal where reminders will be synced under."
              )}
            >
              <Input
                value={config.reminderInboxName}
                onChange={(e: any) => updateConfig("reminderInboxName", e.target.value)}
              />
            </SettingsItem>
          </React.Fragment>
        )}

        <hr style={{ border: "0", borderTop: "1px solid var(--orca-color-border)", margin: "8px 0" }} />

        {/* Sync Calendar Switch */}
        <SettingsItem
          label={t("Sync macOS Calendar")}
          description={t(
            "Enable synchronization of events from macOS Calendar app."
          )}
        >
          <div style={{ display: "flex", alignItems: "center", height: "32px" }}>
            <Checkbox
              checked={!!config.syncCalendar}
              onChange={({ checked }) => updateConfig("syncCalendar", checked)}
            />
          </div>
        </SettingsItem>

        {config.syncCalendar && (
          <React.Fragment>
            {/* Calendar Filter Names */}
            <SettingsItem
              label={t("Calendar Names (comma separated)")}
              vertical
              description={t(
                "Comma-separated list of calendar names to sync. Leave empty to sync all."
              )}
            >
              <Input
                value={config.calendarNames || ""}
                onChange={(e: any) => updateConfig("calendarNames", e.target.value)}
                placeholder="e.g. Calendar, Work, Family"
              />
            </SettingsItem>

            {/* Calendar Range Selection Dropdown */}
            <SettingsItem
              label={t("Calendar Range")}
              vertical
              description={t("Select date range for calendar sync.")}
            >
              <Select
                selected={[config.calendarRange || "today"]}
                options={[
                  { value: "today", label: t("Today Only") },
                  { value: "today_tomorrow", label: t("Today & Tomorrow") },
                  { value: "week", label: t("This Week") },
                ]}
                onChange={(selected) => updateConfig("calendarRange", selected[0])}
              />
            </SettingsItem>

            {/* Calendar Inbox Heading Title */}
            <SettingsItem
              label={t("Calendar Inbox Heading")}
              vertical
              description={t(
                "The heading text in Daily Journal where calendar events will be synced under."
              )}
            >
              <Input
                value={config.calendarInboxName}
                onChange={(e: any) => updateConfig("calendarInboxName", e.target.value)}
              />
            </SettingsItem>
          </React.Fragment>
        )}

        <hr style={{ border: "0", borderTop: "1px solid var(--orca-color-border)", margin: "8px 0" }} />

        {/* Auto Sync Timer Duration */}
        <SettingsItem
          label={t("Auto Sync Interval (Minutes)")}
          vertical
          description={t(
            "Interval in minutes for automatic background sync. Set to 0 to disable auto sync."
          )}
        >
          <Input
            type="number"
            value={config.autoSyncInterval}
            onChange={(e: any) =>
              updateConfig("autoSyncInterval", parseFloat(e.target.value) || 0)
            }
          />
        </SettingsItem>
      </SettingsSection>
    </div>
  );
}
