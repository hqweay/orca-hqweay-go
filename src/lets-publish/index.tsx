import { BasePlugin } from "@/libs/BasePlugin";
import { PropType } from "@/libs/consts";
import { setupL10N, t } from "@/libs/l10n";
import { Block } from "../orca";
import { format } from "date-fns";



export default class PublishPlugin extends BasePlugin {
  public getSettingsSchema(): any {
    return {
      // Image Bed Settings
      ...this.defineSetting(
        "imageBed.owner",
        "Image Bed Owner",
        "GitHub Username/Org for Image Bed",
      ),
      ...this.defineSetting(
        "imageBed.repo",
        "Image Bed Repo",
        "Repository Name for Image Bed",
      ),
      ...this.defineSetting(
        "imageBed.branch",
        "Image Bed Branch",
        "Branch for Image Bed",
        "master",
      ),
      ...this.defineSetting(
        "imageBed.path",
        "Image Bed Path",
        "Path prefix (e.g. img/)",
        "img/",
      ),
      ...this.defineSetting(
        "imageBed.token",
        "Image Bed Token",
        "GitHub Token for Image Bed",
      ),

      // Blog Settings
      ...this.defineSetting(
        "blog.owner",
        "Blog Owner",
        "GitHub Username/Org for Blog",
      ),
      ...this.defineSetting(
        "blog.repo",
        "Blog Repo",
        "Repository Name for Blog",
      ),
      ...this.defineSetting(
        "blog.branch",
        "Blog Branch",
        "Branch for Blog",
        "main",
      ),
      ...this.defineSetting(
        "blog.path",
        "Blog Path",
        "Path prefix (e.g. source/_posts/)",
        "source/_posts/",
      ),
      ...this.defineSetting(
        "blog.domain",
        "Blog Domain",
        "Domain for Blog URL (e.g. https://leay.net)",
      ),
      ...this.defineSetting(
        "tagLabel",
        "Tag Label",
        "Tag Label for Published Blocks",
        "已发布",
      ),
      ...this.defineSetting(
        "blog.token",
        "Blog Token",
        "GitHub Token for Blog (can be same as Image Bed)",
      ),

      // Committer Info
      ...this.defineSetting(
        "committer.name",
        "Committer Name",
        "Name for git commits",
        "orca-hqweay-go-bot",
      ),
      ...this.defineSetting(
        "committer.email",
        "Committer Email",
        "Email for git commits",
        "bot@leay.net",
      ),
    };
  }

  public async load(): Promise<void> {
    // Register Block Menu Command
    if (orca.blockMenuCommands.registerBlockMenuCommand) {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${this.name}.publish-block`,
        {
          worksOnMultipleBlocks: false,
          render: (blockId: number, rootBlockId: number, close: any) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;

            // 为块也启用吧
            // const block = orca.state.blocks[blockId];
            // if (!block || block.parent) return null;

            return (
              <MenuText
                preIcon="ti ti-book-upload"
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

    this.logger.debug(`${this.name} loaded.`);
  }

  public async unload(): Promise<void> {
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      `${this.name}.publish-block`,
    );
    orca.commands.unregisterCommand(`${this.name}.publish-block`);
    this.logger.debug(`${this.name} unloaded.`);
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
    const blogDomain = settings[`${this.name}.blog.domain`] || "";
    const blogToken = (settings[`${this.name}.blog.token`] || "").trim();
    const ibToken = (settings[`${this.name}.imageBed.token`] || "").trim();
    const tagLabel = settings[`${this.name}.tagLabel`] || "已发布";

    if (!ibToken || !blogToken) {
      throw new Error("Missing GitHub tokens in settings.");
    }

    // 2. MD Generation
    // Pass root block to generator
    let mdContent = await this.generateMarkdown(block);

    const lines = mdContent.split("\n");
    const firstLine = lines[0] || "";
    const title = firstLine.replace(/#+\s*/, "").trim() || "Untitled";

    if (lines.length > 0) {
      lines.shift();
      mdContent = lines.join("\n").trim();
    }

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
        .filter((t) => t && t !== tagLabel)
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
    // Default slug to timestamp
    let slug = format(new Date(), "yyyyMMddHHmmss");
    let existingPath = "";
    let publishDate = new Date(); // Default to now if not found

    // Search for metadata in refs (tag properties)
    if (block.refs) {
      for (const ref of block.refs) {
        if (ref.data) {
          // Check if this ref is our "Published" tag
          // We prioritize finding 'github_url'
          const urlProp = ref.data.find((p) => p.name === "github_url");
          if (urlProp && urlProp.value) {
            const githubUrl = urlProp.value;
            // Parse path from GitHub URL
            // Format: https://github.com/owner/repo/blob/branch/path/to/file.md
            // We need to extract the part after `blob/{branch}/`
            // But strict parsing might be fragile if branch has slashes.
            // Alternative: remove the prefix `https://github.com/{owner}/{repo}/blob/{branch}/`
            const prefix = `https://github.com/${blogOwner}/${blogRepo}/blob/${blogBranch}/`;
            if (githubUrl.startsWith(prefix)) {
              existingPath = githubUrl.slice(prefix.length);
              const filename = existingPath.split("/").pop() || "";
              // Standard format: {slug}.md
              slug = filename.replace(".md", "");
            }

            // Try to find existing publish_date
            const dateProp = ref.data.find((p) => p.name === "publish_date");
            if (dateProp && dateProp.value) {
              try {
                publishDate = new Date(dateProp.value);
              } catch (e) {
                this.logger.warn(
                  "Invalid publish_date found, resetting to now.",
                );
              }
            }
            break;
          }
        }
      }
    }

    const frontmatter = `---
permalink: /${slug}/
title: ${title}
date: "${format(publishDate, "yyyy-MM-dd HH:mm:ss")}"
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
      const fileData = await this.getFileSha(
        blogToken,
        blogOwner,
        blogRepo,
        filename,
        blogBranch,
      );
      if (fileData && fileData.sha) {
        isUpdate = true;
        existingSha = fileData.sha;
      }
    }

    // If not found or new, construct filename
    if (!existingSha) {
      filename = `${blogPath}${slug}.md`;
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

    this.logger.debug("Published Article:", res);

    // 5. Update Block Properties

    // Construct URLs
    const githubUrl = `https://github.com/${blogOwner}/${blogRepo}/blob/${blogBranch}/${filename}`;
    let blogUrl = "";
    if (blogDomain) {
      // Ensure domain doesn't end with slash and slug doesn't start with one?
      // Usually safe to just template.
      // Format: domain/${slug}/
      const domain = blogDomain.endsWith("/")
        ? blogDomain.slice(0, -1)
        : blogDomain;
      blogUrl = `${domain}/${slug}/`;
    }

    // Properties to be stored on the tag reference
    const tagProperties = [
      {
        name: "slug",
        value: slug,
        type: PropType.Text,
      },
      {
        name: "github_url",
        value: githubUrl,
        type: PropType.Text,
      },
      {
        name: "blog_url",
        value: blogUrl,
        type: PropType.Text,
      },
      {
        name: "publish_date",
        value: publishDate, // Store as timestamp for PropType.DateTime
        type: PropType.DateTime,
      },
    ];

    // Reload block to ensure we have latest refs
    const latestBlock =
      (await orca.invokeBackend("get-block", block.id)) || block;

    this.logger.debug("Latest Block:", latestBlock);
    // Verify if tag already exists on this block
    let existingRef = null;
    if (latestBlock.refs) {
      // We need to resolve refs to check alias or text matching tagLabel
      // But checking alias on ref is fastest if it exists
      // If ref.alias is not set, we might need to resolve the block.
      // For simplicity/perf, we assume 'insertTag' sets the alias on the ref usually?
      // Actually, insertTag sets ref.alias? Or just points to a block with that text?
      // Let's rely on finding a ref that points to a block named `tagLabel`.

      // This is async work to verify aliases if not directly present.
      // Or we can just try to insertTag first, get the ID, then update its data on the ref?
      // No, insertTag returns tagId, not refId.

      // Let's iterate and resolve
      for (const ref of latestBlock.refs) {
        if (ref.alias === tagLabel) {
          existingRef = ref;
          break;
        }
        // Resolve if unknown
        if (!ref.alias) {
          const refBlock =
            orca.state.blocks[ref.to] ||
            (await orca.invokeBackend("get-block", ref.to));
          if (refBlock && refBlock.text.trim() === tagLabel) {
            existingRef = ref;
            break;
          }
        }
      }
    }

    if (existingRef) {
      // Explicitly update ref data
      this.logger.debug("Updating existing tag properties...", existingRef);
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        existingRef,
        tagProperties,
      );
      // We also need to ensure the Schema properties exist on the tag definition block
      const tagBlockId = existingRef.to;
      // Ensure the Tag Block schema
      const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
      if (tagBlock) {
        const propsToAdd = [];
        const existingProps = tagBlock.properties || [];

        if (!existingProps.some((p: any) => p.name === "slug")) {
          propsToAdd.push({ name: "slug", type: PropType.Text });
        }

        const githubProp = existingProps.find(
          (p: any) => p.name === "github_url",
        );
        if (!githubProp || githubProp.typeArgs?.subType !== "link") {
          propsToAdd.push({
            name: "github_url",
            type: PropType.Text,
            typeArgs: { subType: "link" },
          });
        }

        const blogProp = existingProps.find((p: any) => p.name === "blog_url");
        if (!blogProp || blogProp.typeArgs?.subType !== "link") {
          propsToAdd.push({
            name: "blog_url",
            type: PropType.Text,
            typeArgs: { subType: "link" },
          });
        }

        const publishDateProp = existingProps.find(
          (p: any) => p.name === "publish_date",
        );
        if (
          !publishDateProp ||
          publishDateProp.typeArgs?.subType !== "datetime"
        ) {
          propsToAdd.push({
            name: "publish_date",
            type: PropType.DateTime,
            typeArgs: { subType: "datetime" },
          });
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
    } else {
      this.logger.debug("Inserting new tag...");
      this.logger.debug("Block ID:", block.id);
      this.logger.debug("Tag Label:", tagLabel);
      this.logger.debug("Tag Properties:", tagProperties);
      // Insert new tag
      const tagBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        block.id,
        tagLabel,
        tagProperties,
      );

      this.logger.debug("Tag Block ID:", tagBlockId);
      // Ensure the Tag Block schema
      const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
      this.logger.debug("Tag Block:", tagBlock);
      if (tagBlock) {
        const propsToAdd = [];
        const existingProps = tagBlock.properties || [];

        const githubProp = existingProps.find(
          (p: any) => p.name === "github_url",
        );
        if (!githubProp || githubProp.typeArgs?.subType !== "link") {
          propsToAdd.push({
            name: "github_url",
            type: PropType.Text,
            typeArgs: { subType: "link" },
          });
        }

        const blogProp = existingProps.find((p: any) => p.name === "blog_url");
        if (!blogProp || blogProp.typeArgs?.subType !== "link") {
          propsToAdd.push({
            name: "blog_url",
            type: PropType.Text,
            typeArgs: { subType: "link" },
          });
        }

        if (!existingProps.some((p: any) => p.name === "publish_date")) {
          propsToAdd.push({ name: "publish_date", type: PropType.DateTime });
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
    }

    this.logger.debug("Updated block tags/properties.");
  }

  private async generateMarkdown(block: Block): Promise<string> {
    this.logger.debug("Generating Markdown via blockConvert for root block...");

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
        undefined,
        true,
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
        // Convert to filename: use original filename but decode it
        // and replace spaces with dashes to avoid URL issues
        let originalName = url.split("/").pop() || "image";
        originalName = decodeURIComponent(originalName).replace(/\s+/g, "-");

        // Ensure extension
        if (!originalName.endsWith(`.${ext}`)) {
          originalName += `.${ext}`;
        }

        const filename = originalName;
        const filePath = `${path}${filename}`;

        // Check if file exists
        const existingFile = await this.getFileSha(
          token,
          owner,
          repo,
          filePath,
          branch,
        );

        let downloadUrl = "";

        if (existingFile && existingFile.download_url) {
          // Already exists, use it
          downloadUrl = existingFile.download_url;
          this.logger.debug(`Image ${filename} exists, reusing.`);
        } else {
          // Upload
          const res = await this.uploadFile(
            token,
            owner,
            repo,
            filePath,
            branch,
            base64,
            `Upload via orca-publish: ${filename}`,
          );
          downloadUrl = res.content.download_url;
        }

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
  ): Promise<any | null> {
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
      return await res.json();
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
