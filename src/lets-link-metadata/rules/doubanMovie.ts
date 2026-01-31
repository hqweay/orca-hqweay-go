import { Rule } from "../types";

export const doubanMovie: Rule = {
  id: "douban-movie",
  name: "Douban Movie",
  urlPattern: /^https:\/\/movie\.douban\.com\/subject\/(\d+)(\/|\/?\?.*)?$/i.toString(),
  tagName: "Douban Movie",
  downloadCover: false,
  script: `
    const meta = { ...baseMeta };
    
    // Title
    const titleElement = doc.querySelector("#content h1");
    const title = (titleElement && titleElement.textContent.trim()) || baseMeta.title;

    // Cover
    const coverElement = doc.querySelector("#mainpic a img");
    const coverUrl = (coverElement && coverElement.getAttribute("src").trim()) || baseMeta.thumbnail;

    // Comment
    const commentElement = doc.querySelector(".j.a_stars > span:last-of-type");
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
export default doubanMovie;
