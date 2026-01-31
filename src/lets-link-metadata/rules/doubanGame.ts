import { Rule } from "../types";

export const doubanGame: Rule = {
  id: "douban-game",
  name: "Douban Game",
  urlPattern: /^https:\/\/www\.douban\.com\/game\/(\d+)(\/|\/?\?.*)?$/i.toString(),
  tagName: "Douban Game",
  downloadCover: false,
  script: `
    const meta = { ...baseMeta };
    
    // Title
    const titleElement = doc.querySelector("#content h1");
    const title = (titleElement && titleElement.textContent.trim()) || baseMeta.title;

    // Cover
    const coverElement = doc.querySelector(".item-subject-info .pic a img");
    const coverUrl = (coverElement && coverElement.getAttribute("src").trim()) || baseMeta.thumbnail;

    // Comment/Rating
    const commentElement = doc.querySelector(".collection-comment");
    const comment = (commentElement && commentElement.textContent.trim()) || "";

    return [
        { name: "链接", type: PropType.Text, value: url, typeArgs: { subType: "link" } },
        { name: "标题", type: PropType.Text, value: title },
        { name: "封面", type: PropType.Text, value: coverUrl, typeArgs: { subType: "image" } },
        { name: "评论", type: PropType.Text, value: comment },
    ];
    `.split("\n"),
  enabled: true,
};
export default doubanGame;
