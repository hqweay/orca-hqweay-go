import { Block } from "../orca";
import { PropType } from "@/libs/consts";
import { ensureBlockInState } from "@/libs/utils";
import { format } from "date-fns";
import { PublishSettings } from "./types";
import { extract } from "./markdownExtractor";
import { getFileSha, uploadFile } from "./githubAdapter";
import { generateSlug, extractImageLinks, replaceImageUrl, arrayBufferToBase64 } from "./utils";

export async function publishWorkflow(
  block: Block,
  settings: PublishSettings,
  logger: any,
): Promise<void> {
  const ibOwner = settings.imageBed?.owner;
  const ibRepo = settings.imageBed?.repo;
  const ibBranch = settings.imageBed?.branch || "master";
  const ibPath = settings.imageBed?.path || "img/";

  const blogOwner = settings.blog?.owner;
  const blogRepo = settings.blog?.repo;
  const blogBranch = settings.blog?.branch || "main";
  const blogPath = settings.blog?.path || "source/_posts/";
  const blogDomain = settings.blog?.domain || "";
  
  const blogToken = (settings.blog?.token || "").trim();
  const ibToken = (settings.imageBed?.token || "").trim();
  const tagLabel = settings.tagLabel || "已发布";
  const poetryTag = settings.poetryTag || "";
  
  const committerName = settings.committer?.name || "orca-bot";
  const committerEmail = settings.committer?.email || "bot@orca.note";

  if (!ibToken || !blogToken) {
    throw new Error("Missing GitHub tokens in settings.");
  }

  // 1. Extract markdown and tags
  const { markdown, title, tags } = await extract(block);
  let mdContent = markdown;

  // Filter out the system tagLabel
  const filteredTags = tags.filter((t) => t !== tagLabel);

  if (poetryTag && filteredTags.includes(poetryTag)) {
    mdContent = mdContent.replace(/\n\n/g, "\n").replace(/\n/g, "  \n");
  }

  const tagStr =
    filteredTags.length > 0
      ? `tags:\n${filteredTags.map((t: string) => `  - ${t}`).join("\n")}`
      : "";

  // 2. Resolve metadata from existing block refs (github_url, publish_date, slug)
  let existingPath = "";
  let publishDate = new Date();
  let slug = "";

  if (block.refs) {
    for (const ref of block.refs) {
      if (ref.data) {
        const urlProp = ref.data.find((p) => p.name === "github_url");
        if (urlProp && urlProp.value) {
          const githubUrl = urlProp.value;
          const prefix = `https://github.com/${blogOwner}/${blogRepo}/blob/${blogBranch}/`;
          if (githubUrl.startsWith(prefix)) {
            existingPath = githubUrl.slice(prefix.length);
            const filename = existingPath.split("/").pop() || "";
            slug = filename.replace(".md", "");
          }

          const dateProp = ref.data.find((p) => p.name === "publish_date");
          if (dateProp && dateProp.value) {
            try {
              publishDate = new Date(dateProp.value);
            } catch (e) {
              logger.warn("Invalid publish_date found, resetting to now.");
            }
          }
          break;
        }
      }
    }
  }

  if (!slug) {
    slug = generateSlug(title, block.id);
  }

  // 3. Assemble Frontmatter
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

  // 4. Process Images
  const images = extractImageLinks(mdContent);
  const urlMap = new Map<string, string>();

  for (const img of images) {
    if (img.url.startsWith("http")) continue;

    if (urlMap.has(img.url)) {
      mdContent = replaceImageUrl(mdContent, img.fullMatch, img.alt, urlMap.get(img.url)!);
      continue;
    }

    try {
      const response = await fetch(img.url);
      if (!response.ok) throw new Error("Fetch failed");
      const blob = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(blob);

      const ext = img.url.split(".").pop() || "png";
      let originalName = img.url.split("/").pop() || "image";
      originalName = decodeURIComponent(originalName).replace(/\s+/g, "-");

      if (!originalName.endsWith(`.${ext}`)) {
        originalName += `.${ext}`;
      }

      const filename = originalName;
      const filePath = `${ibPath}${filename}`;

      // Check if exists
      const existingFile = await getFileSha(ibToken, ibOwner!, ibRepo!, filePath, ibBranch);
      
      let downloadUrl = "";
      if (existingFile && existingFile.download_url) {
        downloadUrl = existingFile.download_url;
        logger.debug(`Image ${filename} exists, reusing.`);
      } else {
        const res = await uploadFile(
          ibToken, ibOwner!, ibRepo!, filePath, ibBranch, base64,
          `Upload via orca-publish: ${filename}`,
          undefined, committerName, committerEmail
        );
        downloadUrl = res.content.download_url;
      }

      urlMap.set(img.url, downloadUrl);
      mdContent = replaceImageUrl(mdContent, img.fullMatch, img.alt, downloadUrl);
    } catch (e) {
      logger.error("Failed to upload image", img.url, e);
    }
  }

  // 5. Upload Markdown File
  let filename = "";
  let isUpdate = false;
  let existingSha: string | undefined;

  if (existingPath) {
    filename = existingPath;
    const fileData = await getFileSha(blogToken, blogOwner!, blogRepo!, filename, blogBranch);
    if (fileData && fileData.sha) {
      isUpdate = true;
      existingSha = fileData.sha;
    }
  }

  if (!existingSha) {
    filename = `${blogPath}${slug}.md`;
  }

  const res = await uploadFile(
    blogToken, blogOwner!, blogRepo!, filename, blogBranch,
    window.btoa(unescape(encodeURIComponent(mdContent))), // base64 encode
    `Post: ${title}`,
    existingSha, committerName, committerEmail
  );
  logger.debug("Published Article:", res);

  // 6. Update Block Properties
  const githubUrl = `https://github.com/${blogOwner}/${blogRepo}/blob/${blogBranch}/${filename}`;
  let blogUrl = "";
  if (blogDomain) {
    const domain = blogDomain.endsWith("/") ? blogDomain.slice(0, -1) : blogDomain;
    blogUrl = `${domain}/${slug}/`;
  }

  const tagProperties = [
    { name: "github_url", value: githubUrl, type: PropType.Text },
    { name: "blog_url", value: blogUrl, type: PropType.Text },
    { name: "publish_date", value: publishDate, type: PropType.DateTime },
  ];

  const latestBlock = (await orca.invokeBackend("get-block", block.id)) || block;
  let existingRef = null;
  
  if (latestBlock.refs) {
    for (const ref of latestBlock.refs) {
      if (ref.alias === tagLabel) {
        existingRef = ref;
        break;
      }
      if (!ref.alias) {
        const refBlock = await ensureBlockInState(ref.to);
        if (refBlock && refBlock.text?.trim() === tagLabel) {
          existingRef = ref;
          break;
        }
      }
    }
  }

  if (existingRef) {
    logger.debug("Updating existing tag properties...", existingRef);
    await orca.commands.invokeEditorCommand("core.editor.setRefData", null, existingRef, tagProperties);
    
    const tagBlockId = existingRef.to;
    const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
    if (tagBlock) {
      const propsToAdd = [];
      const existingProps = tagBlock.properties || [];

      const githubProp = existingProps.find((p: any) => p.name === "github_url");
      if (!githubProp || githubProp.typeArgs?.subType !== "link") {
        propsToAdd.push({ name: "github_url", type: PropType.Text, typeArgs: { subType: "link" } });
      }

      const blogProp = existingProps.find((p: any) => p.name === "blog_url");
      if (!blogProp || blogProp.typeArgs?.subType !== "link") {
        propsToAdd.push({ name: "blog_url", type: PropType.Text, typeArgs: { subType: "link" } });
      }

      const publishDateProp = existingProps.find((p: any) => p.name === "publish_date");
      if (!publishDateProp || publishDateProp.typeArgs?.subType !== "datetime") {
        propsToAdd.push({ name: "publish_date", type: PropType.DateTime, typeArgs: { subType: "datetime" } });
      }

      if (propsToAdd.length > 0) {
        await orca.commands.invokeEditorCommand("core.editor.setProperties", null, [tagBlockId], propsToAdd);
      }
    }
  } else {
    logger.debug("Inserting new tag...");
    const tagBlockId = await orca.commands.invokeEditorCommand("core.editor.insertTag", null, block.id, tagLabel, tagProperties);

    const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
    if (tagBlock) {
      const propsToAdd = [];
      const existingProps = tagBlock.properties || [];

      const githubProp = existingProps.find((p: any) => p.name === "github_url");
      if (!githubProp || githubProp.typeArgs?.subType !== "link") {
        propsToAdd.push({ name: "github_url", type: PropType.Text, typeArgs: { subType: "link" } });
      }

      const blogProp = existingProps.find((p: any) => p.name === "blog_url");
      if (!blogProp || blogProp.typeArgs?.subType !== "link") {
        propsToAdd.push({ name: "blog_url", type: PropType.Text, typeArgs: { subType: "link" } });
      }

      if (!existingProps.some((p: any) => p.name === "publish_date")) {
        propsToAdd.push({ name: "publish_date", type: PropType.DateTime });
      }

      if (propsToAdd.length > 0) {
        await orca.commands.invokeEditorCommand("core.editor.setProperties", null, [tagBlockId], propsToAdd);
      }
    }
  }

  logger.debug("Updated block tags/properties.");
}
