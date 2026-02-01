import { Rule } from "../types";

export const doubanBook: Rule = {
  id: "douban-book",
  name: "Douban Book",
  urlPattern:
    /^https:\/\/(book\.douban\.com|m\.douban\.com\/book)\/subject\/(\d+)(\/|\/?\?.*)?$/i.toString(),
  tagName: "Douban Book",
  downloadCover: false,
  script: `
    const findElementByText = (text) => {
      const elements = doc.querySelectorAll("span.pl");
      for (const el of elements) {
        if (el.textContent.includes(text)) return el;
      }
      return null;
    };

    const meta = { ...baseMeta }; // Start with base meta
    // Douban specific overrides
    // 提取书籍ID
    const match = url.match(/\\/subject\\/(\\d+)/);
    const doubanId = (match && match[1]) || "";
    
    // 提取书名
    const titleElement = doc.querySelector("h1 span");
    const bookTitle = (titleElement && titleElement.textContent.trim()) || baseMeta.title;

    const coverElement = doc.querySelector("#mainpic img");
    const coverUrl = (coverElement && coverElement.getAttribute("src").trim()) || baseMeta.cover;

    // 提取作者
    const authorElement = doc.querySelector("#info span:first-child a");
    const author = (authorElement && authorElement.textContent.trim()) || "";

    // 提取出版社
    const publisherElement = findElementByText("出版社");
    const publisher =
      (publisherElement &&
        publisherElement.nextElementSibling &&
        publisherElement.nextElementSibling.textContent.trim()) ||
      "";

    // 提取出品方
    const producerElement = findElementByText("出品方");
    const producer =
      (producerElement &&
        producerElement.nextElementSibling &&
        producerElement.nextElementSibling.textContent.trim()) ||
      "";

    // 提取副标题
    const subtitleElement = findElementByText("副标题");
    const subtitle =
      (subtitleElement &&
        subtitleElement.nextSibling &&
        subtitleElement.nextSibling.textContent.trim()) ||
      "";

    // 提取出版年
    const publishDateElement = findElementByText("出版年");
    const publishDate =
      (publishDateElement &&
        publishDateElement.nextSibling &&
        publishDateElement.nextSibling.textContent.trim()) ||
      "";

    // 提取页数
    const pagesElement = findElementByText("页数");
    const pages =
      (pagesElement &&
        pagesElement.nextSibling &&
        pagesElement.nextSibling.textContent.trim()) ||
      "";

    // 提取定价
    const priceElement = findElementByText("定价");
    const price =
      (priceElement &&
        priceElement.nextSibling &&
        priceElement.nextSibling.textContent.trim()) ||
      "";

    // 提取装帧
    const bindingElement = findElementByText("装帧");
    const binding =
      (bindingElement &&
        bindingElement.nextSibling &&
        bindingElement.nextSibling.textContent.trim()) ||
      "";

    // 提取ISBN
    const isbnElement = findElementByText("ISBN");
    const isbn =
      (isbnElement &&
        isbnElement.nextSibling &&
        isbnElement.nextSibling.textContent.trim()) ||
      "";

    // 提取简介 (作为正文内容)
    const summaryElement = doc.querySelector("#link-report .intro p") || doc.querySelector("#link-report .intro") || doc.querySelector(".section-intro_desc");
    const summary = (summaryElement && summaryElement.textContent.trim()) || "";

    const cleanDoubanUrl = doubanId ? \`https://book.douban.com/subject/\${doubanId}/\` : url;

    return [
        { name: "链接", type: PropType.Text, value: cleanDoubanUrl, typeArgs: { subType: "link" } },
        { name: "标题", type: PropType.Text, value: bookTitle },
        { name: "封面", type: PropType.Text, value: coverUrl, typeArgs: { subType: "image" } },
        { name: "作者", type: PropType.Text, value: author },
        { name: "出版社", type: PropType.Text, value: publisher },
        { name: "出品方", type: PropType.Text, value: producer },
        { name: "副标题", type: PropType.Text, value: subtitle },
        { name: "出版年", type: PropType.Text, value: publishDate },
        { name: "页数", type: PropType.Text, value: pages },
        { name: "定价", type: PropType.Text, value: price },
        { name: "装帧", type: PropType.Text, value: binding },
        { name: "ISBN", type: PropType.Text, value: isbn },
        { name: "正文", type: PropType.Text, value: summary },
    ];
    `.split("\n"),
  enabled: true,
};
export default doubanBook;
