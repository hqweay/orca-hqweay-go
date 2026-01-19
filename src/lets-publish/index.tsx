import { BasePlugin } from "@/libs/BasePlugin";
import { setupL10N, t } from "@/libs/l10n";
import { Block } from "../orca";
import { format } from "date-fns";

const PropType = {
  JSON: 0,
  Text: 1,
  BlockRefs: 2,
  Number: 3,
  Boolean: 4,
  DateTime: 5,
  TextChoices: 6,
} as const;

export default class PublishPlugin extends BasePlugin {
  public getSettingsSchema(): any {
    const s = (key: string, label: string, desc: string, def = "") => ({
      [`${this.name}.${key}`]: {
        label: t(`${this.name}.${label}`),
        description: t(desc),
        type: "string",
        defaultValue: def,
      },
    });

    return {
      // Image Bed Settings
      ...s(
        "imageBed.owner",
        "Image Bed Owner",
        "GitHub Username/Org for Image Bed",
      ),
      ...s("imageBed.repo", "Image Bed Repo", "Repository Name for Image Bed"),
      ...s(
        "imageBed.branch",
        "Image Bed Branch",
        "Branch for Image Bed",
        "master",
      ),
      ...s(
        "imageBed.path",
        "Image Bed Path",
        "Path prefix (e.g. img/)",
        "img/",
      ),
      ...s("imageBed.token", "Image Bed Token", "GitHub Token for Image Bed"),

      // Blog Settings
      ...s("blog.owner", "Blog Owner", "GitHub Username/Org for Blog"),
      ...s("blog.repo", "Blog Repo", "Repository Name for Blog"),
      ...s("blog.branch", "Blog Branch", "Branch for Blog", "main"),
      ...s(
        "blog.path",
        "Blog Path",
        "Path prefix (e.g. source/_posts/)",
        "source/_posts/",
      ),
      ...s(
        "blog.token",
        "Blog Token",
        "GitHub Token for Blog (can be same as Image Bed)",
      ),

      // Committer Info
      ...s(
        "committer.name",
        "Committer Name",
        "Name for git commits",
        "orca-bot",
      ),
      ...s(
        "committer.email",
        "Committer Email",
        "Email for git commits",
        "bot@orca.note",
      ),
    };
  }

  public async onLoad(): Promise<void> {
    // Register Block Menu Command
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.publish-block`,
        {
          worksOnMultipleBlocks: false,
          render: (blockId: number, rootBlockId: number, close: any) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;

            return (
              <MenuText
                title={t("Publish to GitHub")}
                onClick={() => {
                  close();
                  orca.commands.invokeCommand(
                    `${this.name}.publish-block`,
                    blockId,
                  );
                }}
              />
            );
          },
        },
      );
    }

    // Register Command
    orca.commands.registerCommand(
      `${this.name}.publish-block`,
      async (blockId: number) => {
        const block = await orca.invokeBackend("get-block", blockId);
        if (!block) {
          orca.notify("error", t("Block not found."));
          return;
        }

        orca.notify("info", t("Starting publish workflow..."));

        try {
          await this.publishWorkflow(block);
          orca.notify("success", t("Published successfully!"));
        } catch (e: any) {
          this.logger.error("Publish failed", e);
          orca.notify("error", t(`Publish failed: ${e.message}`));
        }
      },
      t("Publish Block to GitHub"),
    );

    this.logger.info(`${this.name} loaded.`);
  }

  public async onUnload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.publish-block`,
    );
    orca.commands.unregisterCommand(`${this.name}.publish-block`);
    this.logger.info(`${this.name} unloaded.`);
  }

  private async publishWorkflow(block: Block) {
    const settings = orca.state.plugins[this.mainPluginName]?.settings || {};

    // Image Bed Config
    const ibOwner = settings[`${this.name}.imageBed.owner`];
    const ibRepo = settings[`${this.name}.imageBed.repo`];
    const ibBranch = settings[`${this.name}.imageBed.branch`] || "master";
    const ibPath = settings[`${this.name}.imageBed.path`] || "img/";
    // Removed duplicate ibToken declaration here

    // Blog Config
    const blogOwner = settings[`${this.name}.blog.owner`];
    const blogRepo = settings[`${this.name}.blog.repo`];
    const blogBranch = settings[`${this.name}.blog.branch`] || "main";
    const blogPath = settings[`${this.name}.blog.path`] || "source/_posts/";
    const blogToken = (settings[`${this.name}.blog.token`] || "").trim();
    const ibToken = (settings[`${this.name}.imageBed.token`] || "").trim();

    if (!ibToken || !blogToken) {
      throw new Error("Missing GitHub tokens in settings.");
    }

    // 2. MD Generation
    const title = block.aliases?.[0] || "Untitled";

    // Pass root block to generator
    let mdContent = await this.generateMarkdown(block);

    // Add Frontmatter
    // Extract tags from refs
    let tagList: string[] = [];
    if (block.refs && block.refs.length > 0) {
      const tagPromises = block.refs.map(async (ref) => {
        if (ref.alias) return ref.alias;
        // If no alias, try to get block text from state or backend
        const refBlock =
          orca.state.blocks[ref.to] ||
          (await orca.invokeBackend("get-block", ref.to));
        return refBlock?.text || "";
      });

      const resolvedTags = await Promise.all(tagPromises);
      tagList = resolvedTags
        .filter((t) => t && t !== "已发布")
        .map((t) => t.trim());
    }

    // Ensure "博客" tag is present for the blog post
    // if (!tagList.includes("博客")) {
    //   tagList.push("博客");
    // }

    const tagStr =
      tagList.length > 0
        ? `tags:\n${tagList.map((t: string) => `  - ${t}`).join("\n")}`
        : "";
    // 4. Upload Article
    // 4. Upload Article
    // Default slug to timestamp
    let slug = format(new Date(), "yyyyMMddHHmmss");
    let existingPath = "";

    // Search for 'slug' in refs (tag properties)
    if (block.refs) {
      for (const ref of block.refs) {
        if (ref.data) {
          const sp = ref.data.find((p) => p.name === "slug");
          if (sp && sp.value) {
            slug = sp.value;
            // Reconstruct path from slug for update check
            existingPath = `${blogPath}${slug}-${block.id}.md`;
            break;
          }
        }
      } 
    }

    const frontmatter = `---
permalink: /${slug}-${block.id}/
title: ${title}
date: "${format(new Date(), "yyyy-MM-dd HH:mm:ss")}"
updated: "${format(new Date(), "yyyy-MM-dd HH:mm:ss")}"
${tagStr}
comments: true
toc: true
---

`;
    mdContent = frontmatter + mdContent;

    // 3. Process Images
    mdContent = await this.processImages(
      mdContent,
      ibToken,
      ibOwner,
      ibRepo,
      ibPath,
      ibBranch,
    );

    let filename = "";
    let isUpdate = false;
    let existingSha: string | undefined;

    if (existingPath) {
      filename = existingPath;
      const sha = await this.getFileSha(
        blogToken,
        blogOwner,
        blogRepo,
        filename,
        blogBranch,
      );
      if (sha) {
        isUpdate = true;
        existingSha = sha;
      }
    }

    // If not found or new, construct filename
    if (!existingSha) {
      filename = `${blogPath}${slug}-${block.id}.md`;
    }

    // Upload
    const res = await this.uploadFile(
      blogToken,
      blogOwner,
      blogRepo,
      filename,
      blogBranch,
      this.toBase64(mdContent),
      `Post: ${title}`,
      existingSha,
    );

    this.logger.info("Published Article:", res);

    // 5. Update Block Properties
    // Store only 'slug' in '已发布' tag properties
    const tagLabel = "已发布";

    // Properties to be stored on the tag reference
    const tagProperties = [
      {
        name: "slug",
        value: slug,
        type: PropType.Text,
      },
    ];

    // Insert '已发布' tag with properties
    const tagBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      block.id,
      tagLabel,
      tagProperties,
    );

    // Ensure the Tag Block ("已发布") has these properties defined in its schema
    const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
    if (tagBlock) {
      const propsToAdd = [];
      const existingProps = tagBlock.properties || [];

      if (!existingProps.some((p: any) => p.name === "slug")) {
        propsToAdd.push({ name: "slug", type: PropType.Text });
      }

      if (propsToAdd.length > 0) {
        await orca.commands.invokeEditorCommand(
          "core.editor.setProperties",
          null,
          [tagBlockId],
          propsToAdd,
        );
      }
    }

    this.logger.info("Updated block tags/properties.");
  }

  private async generateMarkdown(block: Block): Promise<string> {
    this.logger.info("Generating Markdown via blockConvert for root block...");

    try {
      // Use the block from state to ensure it has the correct structure (children IDs) expected by the converter
      // if converting recursively.
      const rootBlock = orca.state.blocks[block.id] || block;
      const repr = this.getRepr(rootBlock);

      let content = await orca.converters.blockConvert(
        "markdown",
        rootBlock,
        repr,
        // rootBlock
      );

      return content || "";
    } catch (e) {
      this.logger.error("blockConvert failed", e);
      return "";
    }
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

  private async processImages(
    content: string,
    token: string,
    owner: string,
    repo: string,
    path: string,
    branch: string,
  ): Promise<string> {
    const regex = /!\[(.*?)\]\((.*?)\)/g;
    let newContent = content;
    let match;
    const matches = [];
    while ((match = regex.exec(content)) !== null) {
      matches.push(match);
    }

    const urlMap = new Map<string, string>();

    for (const m of matches) {
      const [fullMatch, alt, url] = m;
      if (url.startsWith("http")) continue;

      if (urlMap.has(url)) {
        newContent = newContent.replace(
          fullMatch,
          `![${alt}](${urlMap.get(url)})`,
        );
        continue;
      }

      // Local image
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.arrayBuffer();
        const base64 = this.arrayBufferToBase64(blob);

        const ext = url.split(".").pop() || "png";
        const filename = `image-${format(new Date(), "yyyyMMddHHmmss")}-${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;
        const filePath = `${path}${filename}`;

        const res = await this.uploadFile(
          token,
          owner,
          repo,
          filePath,
          branch,
          base64,
          `Upload via orca-publish: ${filename}`,
        );
        const downloadUrl = res.content.download_url;

        urlMap.set(url, downloadUrl);
        // Replace ALL occurrences of this exact `![alt](url)` string.
        newContent = newContent
          .split(fullMatch)
          .join(`![${alt}](${downloadUrl})`);
      } catch (e) {
        this.logger.error("Failed to upload image", url, e);
      }
    }
    return newContent;
  }

  // --- GitHub Helpers ---

  private async getFileSha(
    token: string,
    owner: string,
    repo: string,
    path: string,
    branch: string,
  ): Promise<string | null> {
    // Add timestamp to prevent caching
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        // Log status text if not 200 or 404
        this.logger.warn(`getFileSha failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = await res.json();
      return data.sha;
    } catch (e) {
      this.logger.warn("getFileSha error:", e);
      return null;
    }
  }

  private async uploadFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    branch: string,
    content: string, // Base64 encoded
    message: string,
    sha?: string,
  ) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const settings = orca.state.plugins[this.mainPluginName]?.settings || {};
    const name = settings[`${this.name}.committer.name`] || "orca-bot";
    const email = settings[`${this.name}.committer.email`] || "bot@orca.note";

    const body: any = {
      message,
      content,
      branch,
      committer: { name, email },
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Upload Failed: ${res.status}`, err);
      throw new Error(`Upload Failed: ${res.status} ${err}`);
    }
    return await res.json();
  }

  private toBase64(str: string): string {
    // Handle UTF-8 strings
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
