import { VoiceNotesApi } from "@/api/voicenotes";
import { setupL10N, t } from "@/libs/l10n";
import { ensureInbox } from "@/libs/utils";
import { formatUtil } from "@/libs/format";
// import { Block, DbId, QueryDescription } from "../orca.d.ts" // orca is global
import type { Block, DbId, QueryDescription2 } from "../orca";
import { PropType } from "@/libs/consts";
import zhCN from "@/translations/zhCN";
import type { VoiceNote } from "../types";
import { BasePlugin } from "@/libs/BasePlugin";



export default class VoiceNotesSyncPlugin extends BasePlugin {
  public getSettingsSchema() {
    return {
      [`${this.name}.token`]: {
        label: t(this.name + ".Token"),
        description: t("The Voicenotes API token."),
        type: "string",
      },
      [`${this.name}.inboxName`]: {
        label: t(this.name + ".Inbox name"),
        description: t(
          "The text used for the block where imported notes are placed under.",
        ),
        type: "string",
        defaultValue: "VoiceNotes Inbox",
      },
      [`${this.name}.noteTag`]: {
        label: t(this.name + ".Note tag"),
        description: t("The tag applied to imported notes."),
        type: "string",
        defaultValue: "VoiceNote",
      },
      [`${this.name}.excludeTags`]: {
        label: t(this.name + ".Exclude Tag"),
        description: t(
          "Tag used to exclude notes from syncing (comma separated).",
        ),
        type: "string",
        defaultValue: "orca",
      },
    };
  }

  private async syncVoiceNotes(fullSync: boolean = false) {
    const settings = orca.state.plugins[this.mainPluginName]?.settings;

    if (!settings?.[`${this.name}.token`]) {
      orca.notify(
        "error",
        t("Please provide a Voicenotes API token in plugin settings."),
      );
      return;
    }

    orca.notify("info", t("Starting to sync VoiceNotes, please wait..."));

    const inboxName = settings[`${this.name}.inboxName`] || "VoiceNotes Inbox";
    const noteTag = settings[`${this.name}.noteTag`] || "VoiceNote";

    let lastSyncTime = await orca.plugins.getData(this.name, "syncKey");
    if (fullSync) {
      lastSyncTime = undefined;
    }

    const api = new VoiceNotesApi({
      token: settings[`${this.name}.token`],
      lastSyncedNoteUpdatedAt: lastSyncTime,
    });

    try {
      let recordingsResponse = await api.getRecordings();
      let allNotes: VoiceNote[] = [];

      while (recordingsResponse && recordingsResponse.data) {
        allNotes.push(...recordingsResponse.data);
        if (allNotes.length >= 2) break;
        if (recordingsResponse.links && recordingsResponse.links.next) {
          recordingsResponse = await api.getRecordingsFromLink(
            recordingsResponse.links.next,
          );
        } else {
          break;
        }
      }
      allNotes = allNotes.slice(0, 2);

      if (allNotes.length === 0) {
        orca.notify("info", t("Nothing to sync."));
        return;
      }

      // Group notes by date (created_at)
      const notesByDate: Record<string, VoiceNote[]> = {};
      for (const note of allNotes) {
        // Convert to Local Time
        const date = new Date(note.created_at);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        if (!notesByDate[dateStr]) {
          notesByDate[dateStr] = [];
        }
        notesByDate[dateStr].push(note);
      }

      await orca.commands.invokeGroup(async () => {
        for (const [dateStr, notes] of Object.entries(notesByDate)) {
          // dateStr is YYYY-MM-DD
          // Construct local date
          const [y, m, d] = dateStr.split("-").map(Number);
          const createdAt = new Date(y, m - 1, d); // safe local date construction

          console.log("Syncing notes for date:", createdAt);
          const journal: Block = await orca.invokeBackend(
            "get-journal-block",
            createdAt,
          );
          if (journal == null) continue;

          const inbox = await ensureInbox(journal, inboxName);

          for (const note of notes) {
            // Check exclusion
            if (settings[`${this.name}.excludeTags`]) {
              const excludeTags = settings[`${this.name}.excludeTags`]
                .split(",")
                .map((t: string) => t.trim());
              if (
                note.tags &&
                note.tags.some((t) => excludeTags.includes(t.name))
              ) {
                continue;
              }
            }

            await this.syncNote(note, inbox, noteTag);
          }
        }
      });

      let maxUpdatedAt = lastSyncTime;
      if (allNotes.length > 0) {
        // Find max
        const maxDate = allNotes.reduce((max, note) => {
          return note.updated_at > max ? note.updated_at : max;
        }, allNotes[0].updated_at);
        maxUpdatedAt = maxDate;
      }

      if (maxUpdatedAt) {
        // 子插件的存储
        await orca.plugins.setData(this.name, "syncKey", maxUpdatedAt);
      }

      orca.notify("success", t("VoiceNotes synced successfully."));
    } catch (err) {
      this.logger.error("VOICENOTES SYNC:", err);
      orca.notify("error", t("Failed to sync VoiceNotes."));
    }
  }

  public async load(): Promise<void> {
    setupL10N(orca.state.locale, { "zh-CN": zhCN });

    const Button = orca.components.Button;

    if (orca.state.commands[`${this.name}.voicenotes-sync`] == null) {
      orca.commands.registerCommand(
        `${this.name}.voicenotes-sync`,
        async (fullSync: boolean = false) => {
          await this.syncVoiceNotes(fullSync);
        },
        t("Sync VoiceNotes"),
      );
    }
    if (orca.state.commands[`${this.name}.voicenotes-sync-full`] == null) {
      orca.commands.registerCommand(
        `${this.name}.voicenotes-sync-full`,
        async () => {
          await this.syncVoiceNotes(true);
        },
        t("Sync VoiceNotes Full"),
      );
    }

    if (orca.state.headbarButtons[`${this.name}.voicenotes-sync`] == null) {
      orca.headbar.registerHeadbarButton(`${this.name}.voicenotes-sync`, () => (
        <Button
          variant="plain"
          onClick={async () =>
            orca.commands.invokeCommand(`${this.name}.voicenotes-sync`)
          }
        >
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
          >
            <path
              d="M487.648 240a16 16 0 0 1 16-16h16a16 16 0 0 1 16 16v546.784a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16V240z m155.84 89.04a16 16 0 0 1 16-16h16a16 16 0 0 1 16 16v346.432a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16V329.04z m155.824 144.704a16 16 0 0 1 16-16h16a16 16 0 0 1 16 16v123.824a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16v-123.84z m-467.488-144.704a16 16 0 0 1 16-16h16a16 16 0 0 1 16 16v346.432a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16V329.04zM176 473.76a16 16 0 0 1 16-16h16a16 16 0 0 1 16 16v112.688a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16V473.76z"
              fill="#000000"
            ></path>
          </svg>
        </Button>
      ));
    }

    if (orca.state.blockMenuCommands[`${this.name}.sync-to-vn`] == null) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.sync-to-vn`,
        {
          worksOnMultipleBlocks: false,
          render: (blockId, rootBlockId, close) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;
            return (
              <MenuText
                preIcon="ti ti-refresh"
                title={t("Sync to VoiceNotes")}
                onClick={async () => {
                  close();
                  const block = orca.state.blocks[blockId];
                  if (!block || !block.text) return;

                  const recordingId = this.getRecordingId(block);

                  const repr = this.getRepr(block);

                  let content = await orca.converters.blockConvert(
                    "markdown",
                    block,
                    repr,
                    undefined,
                    true,
                  );

                  await this.addOrUpdate(recordingId, blockId, content || "");
                }}
              />
            );
          },
        },
      );
    }

    this.logger.info(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.headbar.unregisterHeadbarButton(`${this.name}.voicenotes-sync`);
    orca.commands.unregisterCommand(`${this.name}.voicenotes-sync`);
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.sync-to-vn`,
    );
    this.logger.info(`${this.name} unloaded.`);
  }

  private async addOrUpdate(
    recordingid: string | undefined,
    nodeId: string | number,
    text: string,
    tags: string[] = [],
  ) {
    const settings = orca.state.plugins[this.mainPluginName]?.settings;
    if (!settings?.[`${this.name}.token`]) {
      orca.notify("error", t("Please provide a Voicenotes API token."));
      return;
    }

    const api = new VoiceNotesApi({
      token: settings[`${this.name}.token`],
    });

    try {
      if (recordingid) {
        orca.notify("info", t("Updating VoiceNote..."));
        if (tags.length <= 0) {
          // TODO: Load recording to get existing tags if needed?
          // For now just update text
        }
        await api.updateVoiceNote(recordingid, {
          transcript: text,
          // tags: tags.length > 0 ? tags : ["orca"],
          tags: ["orca"],
        });

        orca.notify("success", t("VoiceNote updated."));
      } else {
        orca.notify("info", t("Creating VoiceNote..."));
        const response = await api.createVoiceNote(text);
        if (response && response.recording && response.recording.id) {
          const newId = response.recording.id;
          orca.notify("success", t("VoiceNote created."));

          // Tag as siyuan (or orca)
          await api.tagVoiceNote(newId, ["orca"]);

          const noteTag = settings[`${this.name}.noteTag`] || "VoiceNote";

          // Store ID in a Tag, consistent with syncNote
          const tagBlockId = await orca.commands.invokeEditorCommand(
            "core.editor.insertTag",
            null,
            nodeId,
            noteTag,
            [{ name: "ID", type: 1, value: newId }],
          );
          // Ensure ID property exists on tag
          const tagBlock = orca.state.blocks[tagBlockId];
          if (tagBlock && !tagBlock.properties?.some((p) => p.name === "ID")) {
            await orca.commands.invokeEditorCommand(
              "core.editor.setProperties",
              null,
              [newId],
              [{ name: "ID", type: 1 }],
            );
          }
        } else {
          orca.notify("error", t("Failed to create VoiceNote."));
        }
      }
    } catch (e) {
      console.error(e);
      orca.notify("error", t("Error syncing to VoiceNotes."));
    }
  }

  private getRecordingId(block: Block): string | undefined {
    const settings = orca.state.plugins[this.mainPluginName]?.settings;
    const noteTag = settings?.[`${this.name}.noteTag`] || "VoiceNote";

    // Check refs for ID property (tags are often refs with data)
    if (block.refs && block.refs.length > 0) {
      for (const ref of block.refs) {
        if (ref.alias === noteTag && ref.data && ref.data.length > 0) {
          const idProp = ref.data.find((p) => p.name === "ID");
          if (idProp) {
            return idProp.value;
          }
        }
      }
    }
    return undefined;
  }

  private getRepr(block: Block): any {
    // Return type: Repr
    // Default
    let repr: any = { type: "text" };

    if (block.properties) {
      const reprProp = block.properties.find((p) => p.name === "_repr");
      if (reprProp && reprProp.type === PropType.JSON && reprProp.value) {
        repr = reprProp.value;
      }
    }
    return repr;
  }

  private async syncNote(note: VoiceNote, inbox: Block, noteTag: string) {
    let noteBlock: Block;

    // Check existence
    const resultIds = (await orca.invokeBackend("query", {
      q: {
        kind: 100,
        conditions: [
          {
            kind: 4,
            name: noteTag,
            properties: [{ name: "ID", op: 1, value: note.id }],
            selfOnly: true,
          },
        ],
      },
      pageSize: 12,
    } as QueryDescription2)) as DbId[];

    note.title = this.cleanText(note.title);

    if (resultIds.length > 0) {
      const noteBlockId = resultIds[0];
      noteBlock = orca.state.blocks[noteBlockId]!;
      if (noteBlock == null) {
        const loadedBlock = await orca.invokeBackend("get-block", noteBlockId);
        if (loadedBlock == null) return undefined;
        noteBlock = loadedBlock;
        orca.state.blocks[noteBlock.id] = noteBlock;
      }

      // Update existing?
      // VoiceNotes are immutable usually? Or editable?
      // If updated_at changed, we sync.
      // For simplicity, we overwrite content like dinox-sync.

      // Clear tags
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [noteBlock.id],
        [{ name: "_tags", type: 2, value: [] }],
      );

      // Clear children
      if (noteBlock.children.length > 0) {
        await orca.commands.invokeEditorCommand(
          "core.editor.deleteBlocks",
          null,
          [...noteBlock.children],
        );
      }

      // Update title
      await orca.commands.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null,
        [
          {
            id: noteBlock.id,
            content: [{ t: "t", v: note.title || "Untitled" }],
          },
        ],
      );
    } else {
      // New block
      const noteBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        inbox,
        "lastChild",
        [{ t: "t", v: note.title || "Untitled" }],
        { type: "text" },
        new Date(note.created_at),
        new Date(note.updated_at),
      );
      noteBlock = orca.state.blocks[noteBlockId]!;
    }

    // ID Tag
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      noteBlock.id,
      noteTag,
      [{ name: "ID", type: 1, value: note.id }],
    );

    // Ensure ID property exists on tag
    const tagBlock = orca.state.blocks[tagBlockId];
    if (tagBlock && !tagBlock.properties?.some((p) => p.name === "ID")) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [tagBlock.id],
        [{ name: "ID", type: 1 }],
      );
    }

    // Tags
    if (note.tags?.length) {
      for (const tag of note.tags) {
        await orca.commands.invokeEditorCommand(
          "core.editor.insertTag",
          null,
          noteBlock.id,
          tag.name,
        );
      }
    }

    note.transcript = this.cleanText(note.transcript);
    // 如果包含多行
    if (note.transcript.includes("\n")) {
      // Set as long form display
      await orca.commands.invokeEditorCommand(
        "core.editor.toggleShowAsLongForm",
        null, // cursor can be null for this operation
        noteBlock.id,
      );
    }

    // Creations: Append after transcript
    if (note.creations?.length) {
      for (const creation of note.creations) {
        if (creation.markdown_content) {
          const title =
            this.cleanText(creation.title!) ||
            (creation as any).name ||
            creation.type ||
            "Summary";

          // Insert Title Block
          const titleBlockId = await orca.commands.invokeEditorCommand(
            "core.editor.insertBlock",
            null,
            noteBlock,
            "firstChild",
            // [{ t: "t", v: `## ${title}` }],
            // { type: "text" },
            [{ t: "t", v: `${title}` }],
            { type: "heading", level: 2 },
            new Date(note.created_at),
            new Date(note.updated_at),
          );

          const titleBlock = orca.state.blocks[titleBlockId];
          if (titleBlock) {
            await orca.commands.invokeEditorCommand(
              "core.editor.batchInsertText",
              null,
              titleBlock,
              "firstChild", // Insert as child of title
              this.cleanText(creation.markdown_content),
            );
          }
        }
      }
    }

    // Attachments
    if (note.attachments?.length) {
      const attachmentsBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        noteBlock,
        "firstChild",
        // [{ t: "t", v: `## ${title}` }],
        // { type: "text" },
        [{ t: "t", v: `Attachments` }],
        { type: "heading", level: 2 },
        new Date(note.created_at),
        new Date(note.updated_at),
      );
      const attachmentsBlock = orca.state.blocks[attachmentsBlockId];
      if (attachmentsBlock) {
        for (const attachment of note.attachments) {
          // Basic check if it is an image or we just try to download everything?
          // VoiceNotes attachments seem to be images usually.
          if (attachment.url) {
            try {
              const response = await fetch(attachment.url);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();

                const assetPath = await orca.invokeBackend(
                  "upload-asset-binary",
                  "image/png",
                  arrayBuffer,
                );

                if (assetPath) {
                  // Insert Image block
                  await orca.commands.invokeEditorCommand(
                    "core.editor.insertBlock",
                    null,
                    attachmentsBlock,
                    "firstChild",
                    null,
                    { type: "image", src: assetPath },
                  );
                }
              }
            } catch (e) {
              console.error("Failed to sync attachment", e);
            }
          }
        }
      }
    }

    // Content: Transcript first
    if (note.transcript) {
      const transcriptBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        noteBlock,
        "firstChild",
        // [{ t: "t", v: `## ${title}` }],
        // { type: "text" },
        [{ t: "t", v: `Transcript` }],
        { type: "heading", level: 2 },
        new Date(note.created_at),
        new Date(note.updated_at),
      );

      const transcriptBlock = orca.state.blocks[transcriptBlockId];
      if (transcriptBlock) {
        await orca.commands.invokeEditorCommand(
          "core.editor.batchInsertText",
          null,
          transcriptBlock,
          "firstChild",
          note.transcript,
        );
      }
    }

    // subnotes 先不同步了
    // Subnotes
    // if (note.subnotes?.length) {
    //   // Header
    //   await orca.commands.invokeEditorCommand(
    //     "core.editor.insertBlock",
    //     null,
    //     noteBlock,
    //     "lastChild",
    //     [{ t: "t", v: "Subnotes" }],
    //     { type: "heading", level: 2 },
    //   );

    //   for (const subnote of note.subnotes) {
    //     const subBlockId = await this.syncNote(subnote, inbox, noteTag);
    //     if (subBlockId) {
    //       // Link to it using reference
    //       await orca.commands.invokeEditorCommand(
    //         "core.editor.insertBlock",
    //         null,
    //         noteBlock,
    //         "lastChild",
    //         [
    //           { t: "t", v: "- " },
    //           { t: "r", v: subnote.title || "Untitled", id: subBlockId },
    //         ],
    //       );
    //     }
    //   }
    // }

    // Related Notes
    // if (note.related_notes?.length) {
    //   await orca.commands.invokeEditorCommand(
    //     "core.editor.insertBlock",
    //     null,
    //     noteBlock,
    //     "lastChild",
    //     [{ t: "t", v: "Related Notes" }],
    //     { type: "heading", level: 2 },
    //   );

    // for (const related of note.related_notes) {
    //   const relIds = (await orca.invokeBackend("query", {
    //     q: {
    //       kind: 1,
    //       conditions: [
    //         {
    //           kind: 4,
    //           name: noteTag,
    //           properties: [{ name: "ID", op: 1, value: related.id }],
    //         },
    //       ],
    //     },
    //     pageSize: 1,
    //   } as QueryDescription)) as DbId[];

    //   if (relIds.length > 0) {
    //     await orca.commands.invokeEditorCommand(
    //       "core.editor.insertBlock",
    //       null,
    //       noteBlock,
    //       "lastChild",
    //       [
    //         { t: "t", v: "- " },
    //         { t: "r", v: related.title || "Untitled", id: relIds[0] },
    //       ],
    //     );
    //   } else {
    //     await orca.commands.invokeEditorCommand(
    //       "core.editor.insertBlock",
    //       null,
    //       noteBlock,
    //       "lastChild",
    //       [{ t: "t", v: `- ${related.title || "Untitled"} (Not synced)` }],
    //     );
    //   }
    // }
    // }

    return noteBlock.id;
  }

  // Helper to clean text
  private cleanText(text: string) {
    let t = text;
    // Replace <br> with newline
    t = t.replace(/(<br\s*\/?>\s*)+/gi, "\n\n");
    t = this.convertHtmlToMarkdown(t).replace(/\n+\s+/g, "\n\n");

    // Remove space between Chinese characters
    t = formatUtil.cleanSpacesBetweenChineseCharacters(t);

    // Use formatUtil
    t = formatUtil.formatContent(t);
    // t = formatUtil.deleteSpaces(t);
    // t = formatUtil.insertSpace(t);

    return t;
  }

  private convertHtmlToMarkdown(text: string): string {
    const htmlEntities: { [key: string]: string } = {
      "&lt;": "<",
      "&gt;": ">",
      "&amp;": "&",
      "&quot;": '"',
      "&#39;": "'",
      "&nbsp;": " ",
    };

    // Convert HTML entities
    let markdown = text.replace(
      /&[a-zA-Z0-9#]+;/g,
      (entity) => htmlEntities[entity] || entity,
    );

    // Convert <br/> tags to newlines
    markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

    // Remove other HTML tags
    markdown = markdown.replace(/<\/?[^>]+(>|$)/g, "");

    return markdown.trim();
  }
}
