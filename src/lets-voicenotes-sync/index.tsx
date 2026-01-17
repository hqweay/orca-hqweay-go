import { formatDate } from "date-fns";
import LogoImg from "#/icon.png";
import React from "react";
import { VoiceNotesApi } from "@/api/voicenotes";
import { setupL10N, t } from "@/libs/l10n";
import { ensureInbox } from "@/libs/utils";
import { formatUtil } from "@/utils/format";
// import { Block, DbId, QueryDescription } from "../orca.d.ts" // orca is global
import type { Block, DbId, QueryDescription } from "../orca";
import zhCN from "@/translations/zhCN";
import type { VoiceNote } from "../types";

let pluginName: string;

let thisPluginName = "voicenotes-sync";

export async function load(_name: string) {
  pluginName = _name;

  setupL10N(orca.state.locale, { "zh-CN": zhCN });

  const Button = orca.components.Button;
  const HoverContextMenu = orca.components.HoverContextMenu;
  const MenuText = orca.components.MenuText;

  // Assume user wants their test code.
  // const testBlock = orca.state.blocks[1205];
  // if (testBlock) { ... } // Removed explicit block fetch to avoid errors if block doesn't exist in dev env.

  await orca.plugins.setSettingsSchema(pluginName, {
    token: {
      label: t(thisPluginName + ".Token"),
      description: t("The Voicenotes API token."),
      type: "string",
    },
    inboxName: {
      label: t(thisPluginName + ".Inbox name"),
      description: t(
        "The text used for the block where imported notes are placed under.",
      ),
      type: "string",
      defaultValue: "VoiceNotes Inbox",
    },
    noteTag: {
      label: t(thisPluginName + ".Note tag"),
      description: t(".The tag applied to imported notes."),
      type: "string",
      defaultValue: "VoiceNote",
    },
  });

  if (orca.state.commands["voicenotes.sync"] == null) {
    orca.commands.registerCommand(
      "voicenotes.sync",
      async (fullSync: boolean = false) => {
        const settings = orca.state.plugins[pluginName]?.settings;

        if (!settings?.token) {
          orca.notify(
            "error",
            t("Please provide a Voicenotes API token in plugin settings."),
          );
          return;
        }

        orca.notify("info", t("Starting to sync VoiceNotes, please wait..."));

        const inboxName = settings.inboxName || "VoiceNotes Inbox";
        const noteTag = settings.noteTag || "VoiceNote";

        let lastSyncTime = await orca.plugins.getData(pluginName, "syncKey");
        if (fullSync) {
          lastSyncTime = undefined;
        }

        const api = new VoiceNotesApi({
          token: settings.token,
          lastSyncedNoteUpdatedAt: lastSyncTime,
        });

        // const now = new Date();

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
            const dateStr = note.created_at.split("T")[0]; // YYYY-MM-DD
            if (!notesByDate[dateStr]) {
              notesByDate[dateStr] = [];
            }
            notesByDate[dateStr].push(note);
          }

          await orca.commands.invokeGroup(async () => {
            for (const [dateStr, notes] of Object.entries(notesByDate)) {
              // dateStr is YYYY-MM-DD
              const createdAt = new Date(`${dateStr} 00:00:00`);
              const journal: Block = await orca.invokeBackend(
                "get-journal-block",
                createdAt,
              );
              if (journal == null) continue;
              const inbox = await ensureInbox(journal, inboxName);

              for (const note of notes) {
                await syncNote(note, inbox, noteTag);
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
            await orca.plugins.setData(pluginName, "syncKey", maxUpdatedAt);
          }

          orca.notify("success", t("VoiceNotes synced successfully."));
        } catch (err) {
          console.error("VOICENOTES SYNC:", err);
          orca.notify("error", t("Failed to sync VoiceNotes."));
        }
      },
      t("Sync VoiceNotes"),
    );
  }

  if (orca.state.headbarButtons["voicenotes.sync"] == null) {
    orca.headbar.registerHeadbarButton("voicenotes.sync", () => (
      <HoverContextMenu
        menu={(closeMenu: () => void) => (
          <>
            <MenuText
              title={t("Incremental sync")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand("voicenotes.sync");
              }}
            />
            <MenuText
              title={t("Full sync")}
              onClick={async () => {
                closeMenu();
                await orca.commands.invokeCommand("voicenotes.sync", true);
              }}
            />
          </>
        )}
      >
        <Button
          variant="plain"
          onClick={async () => orca.commands.invokeCommand("voicenotes.sync")}
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
      </HoverContextMenu>
    ));
  }

  console.log(`${pluginName} loaded.`);
}

export async function unload() {
  orca.headbar.unregisterHeadbarButton("voicenotes.sync");
  orca.commands.unregisterCommand("voicenotes.sync");
  // orca.themes.removeCSSResources(pluginName)
  console.log(`${pluginName} unloaded.`);
}

// Helper to clean text
const cleanText = (text: string) => {
  let t = text;
  // Replace <br> with newline
  t = t.replace(/(<br\s*\/?>\s*)+/gi, "\n\n");
  // Remove space between Chinese characters
  t = formatUtil.cleanSpacesBetweenChineseCharacters(t);

  // Use formatUtil
  t = formatUtil.formatContent(t);
  // t = formatUtil.deleteSpaces(t);
  // t = formatUtil.insertSpace(t);

  return t;
};

async function syncNote(note: VoiceNote, inbox: Block, noteTag: string) {
  let noteBlock: Block;

  // Check existence
  const resultIds = (await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 4,
          name: noteTag,
          properties: [{ name: "ID", op: 1, value: note.id }],
        },
      ],
    },
    pageSize: 1,
  } as QueryDescription)) as DbId[];

  if (resultIds.length > 0) {
    const noteBlockId = resultIds[0];
    noteBlock = orca.state.blocks[noteBlockId]!;
    if (noteBlock == null) {
      const loadedBlock = await orca.invokeBackend("get-block", noteBlockId);
      if (loadedBlock == null) return;
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

  // Content: Transcript first
  if (note.transcript) {
    await orca.commands.invokeEditorCommand(
      "core.editor.batchInsertText",
      null,
      noteBlock,
      "firstChild",
      cleanText(note.transcript),
    );
  }

  // Attachments
  if (note.attachments?.length) {
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
                noteBlock,
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

  // Creations: Append after transcript
  if (note.creations?.length) {
    for (const creation of note.creations) {
      if (creation.markdown_content) {
        const title =
          creation.title ||
          (creation as any).name ||
          creation.type ||
          "Summary";

        // Insert Title Block
        const titleBlockId = await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          null,
          noteBlock,
          "firstChild",
          [{ t: "t", v: `${title}` }],
          { type: "text" },
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
            cleanText(creation.markdown_content),
          );
        }
      }
    }
  }
}
