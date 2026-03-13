interface IgnoreBlock {
  start: number;
  end: number;
}

import { standardNames } from "./standardName";

class FormatUtil {
  condenseContent(content: string) {
    // 将 制表符 改成 四个空格
    content = content.replace(/\t/g, "    ");
    // 删除超过2个的回车
    // Unix 的只有 LF，Windows 的需要 CR LF
    content = content.replace(/(\n){3,}/g, "$1$1");
    content = content.replace(/(\r\n){3,}/g, "$1$1");
    return content;
  }
  getIgnoreBlocks(lines: string[], token = "```") {
    const ignoreBlocks: { start: number; end: number | null }[] = [];
    let block: { start: number; end: number | null } | null = null;
    lines.forEach((line, index) => {
      line = line.trim();
      if (line.startsWith(token)) {
        if (!block) {
          block = { start: index, end: null };
        } else {
          if (line === token) {
            block.end = index;
            ignoreBlocks.push(block);
            block = null;
          }
        }
      }
    });
    return ignoreBlocks as IgnoreBlock[];
  }
  deleteSpaces(content: string) {
    // 去掉「`()[]{}<>'"`」: 前后多余的空格
    content = content.replace(/\s+([\(\)\[\]\{\}<>'":])\s+/g, " $1 ");
    // 去掉连续括号增加的空格，例如：「` ( [ { <  > } ] ) `」
    content = content.replace(/([<\(\{\[])\s([<\(\{\[])\s/g, "$1$2 ");
    content = content.replace(/([<\(\{\[])\s([<\(\{\[])\s/g, "$1$2 ");
    content = content.replace(/([<\(\{\[])\s([<\(\{\[])\s/g, "$1$2 ");
    content = content.replace(/([<\(\{\[])\s([<\(\{\[])\s/g, "$1$2 ");
    content = content.replace(/\s([>\)\]\}])\s([>\)\]\}])/g, " $1$2");
    content = content.replace(/\s([>\)\]\}])\s([>\)\]\}])/g, " $1$2");
    content = content.replace(/\s([>\)\]\}])\s([>\)\]\}])/g, " $1$2");
    content = content.replace(/\s([>\)\]\}])\s([>\)\]\}])/g, " $1$2");

    // 去掉 「`$ () $`」, 「`$ [] $`」, 「`$ {} $`」 里面增加的空格
    // 去掉开始 $ 后面增加的空格，结束 $ 前面增加的空格
    // 去掉包裹代码的符号里面增加的空格
    // 去掉开始 ` 后面增加的空格，结束 ` 前面增加的空格 `hello()`
    content = content.replace(
      /([`\$])\s*([<\(\[\{])([^\$]*)\s*([`\$])/g,
      "$1$2$3$4",
    );
    content = content.replace(
      /([`\$])\s*([^\$]*)([>\)\]\}])\s*([`\$])/g,
      "$1$2$3$4",
    );
    // 去掉「`) _`」、「`) ^`」增加的空格
    content = content.replace(/\)\s([_\^])/g, ")$1");
    // 去掉 [^footnote,2002] 中的空格
    content = content.replace(/\[\s*\^([^\]\s]*)\s*\]/g, "[^$1]");
    // 将链接的格式中文括号“[]（）”改成英文括号“[]()”，去掉增加的空格
    content = content.replace(
      /\s*\[\s*([^\]]+)\s*\]\s*[（(]\s*([^\s\)]*)\s*[)）]\s*/g,
      " [$1]($2) ",
    );

    // ![](https://img.com/a.jpg)

    content = content.replace(/\!\[\]\(/g, "![img](");

    // 给双链增加空格 add，不管 ![[wikilink]] ==[[wikilink]]==
    // [[wikilink]]
    // 我爱[[wikilink]]
    // content = content.replace(/\s*[^!=，。、`]\[\[\s*([^\]]+)\s*\]\]\s*/g, ' [[$1]] ');
    // content = content.replace(/\s*([^!=`-])\s*\[\[\s*([^\]]+)\s*\]\]\s*/g, '$1 [[$2]] ');
    // content = content.replace(/([，。、《》？『』「」；：【】｛｝—！＠￥％…（）])\[\[\s*(.*)\s*\]\]\s*/g, '$1[[$2]] ');
    content = content.replace(/\s*\[\[\s*([^\]]+)\s*\]\]\s*/g, " [[$1]] ");
    content = content.replace(/\=\=\s\[\[([^\]]+)\]\]\s\=\=/g, "==[[$1]]==");
    content = content.replace(/\!\s\[\[([^\]]+)\]\]/g, "![[$1]]");

    // 删除链接和中文标点的空格 add
    content = content.replace(
      /([\]\)])\s*([，。、《》？『』「」；：【】｛｝—！＠￥％…（）])/g,
      "$1$2",
    );
    content = content.replace(
      /([，。、《》？『』「」；：【】｛｝—！＠￥％…（）])\s*([\[\()])/g,
      "$1$2",
    );
    // 删除行首非列表的空格 add
    content = content.replace(/^\s*([\[\(])/g, "$1");

    // 将图片链接的格式中的多余空格“! []()”去掉，变成“![]()”
    content = content.replace(
      /!\s*\[\s*([^\]]+)\s*\]\s*[（(]\s*([^\s\)]*)\s*[)）]\s*/g,
      "![$1]($2) ",
    );
    // 将图片链接的。改为.
    content = content.replace(/!\[\[(.*)。(.*)\]\]/g, "![[$1.$2]]");
    // 将网络地址中“ : // ”符号改成“://”
    content = content.replace(/\s*:\s*\/\s*\/\s*/g, "://");
    // 去掉行末空格
    content = content.replace(/(\S*)\s*$/g, "$1");

    content = content.replace(/(^-$)/g, "$1 "); // - outliner 加空格

    // 去掉「123 °」和 「15 %」中的空格
    content = content.replace(/([0-9])\s*([°%])/g, "$1$2");
    // 去掉 2020 - 04 - 20, 08 : 00 : 00 这种日期时间表示的数字内的空格
    content = content.replace(/([0-9])\s*-\s*([0-9])/g, "$1-$2");
    content = content.replace(/([0-9])\s*:\s*([0-9])/g, "$1:$2");
    // 去掉 1 , 234 , 567 这种千分位表示的数字内的空格
    content = content.replace(/([0-9])\s*,\s*([0-9])/g, "$1,$2");

    // 中文冒号后面不需要空格
    content = content.replace(/：\s*/g, "：");

    //去掉 「，  哈哈。 」这样的空格
    // content = content.replace(/([^-])\s*([，。、《》？『』「」；∶【】&｛｝！＠￥％…（）])\s*/g, "$1$2");
    content = content.replace(
      /\s*([，。、《》？『』「」；∶【】｛｝！＠￥％…（）])\s*/g,
      "$1",
    ); // not & like: Tom & Jerry
    // - ！ 哈安  --- 保留这样的空格
    content = content.replace(
      /-([，。、《》？『』「」；∶【】&｛｝！＠￥％…（）])\s*/g,
      "- $1",
    );
    content = content.replace(
      /##([，。、《》？『』「」；∶【】&｛｝！＠￥％…（）])\s*/g,
      "## $1",
    ); // ##【哈哈】：这样的标题得保留空格
    content = content.replace(/-\s*([？&！＠￥％])\s*/g, "- $1 "); // - ！ 提醒事项：这样的行内备注 保留空格

    // 全角標點與其他字符之間不加空格
    // 将无序列表的-后面的空格保留
    // 将有序列表的-后面的空格保留
    content = content.replace(
      /^(?<![-|\d.]\s*)\s*([，。、《》？『』「」；∶【】｛｝—！＠￥％…（）])\s*/g,
      "$1",
    );
    return content;
  }
  insertSpace(content: string) {
    // 在 “中文English” 之间加入空格 “中文 English”
    // 在 “中文123” 之间加入空格 “中文 123”
    content = content.replace(
      /(?<!\[.*\]\(.*)([\u4e00-\u9fa5\u3040-\u30FF])([a-zA-Z0-9`])/g,
      "$1 $2",
    );
    // 在 “English中文” 之间加入空格 “English 中文”
    // 在 “123中文” 之间加入空格 “123 中文”
    content = content.replace(
      /(?<!\[.*\]\(.*)([a-zA-Z0-9%`])([*]*[\u4e00-\u9fa5\u3040-\u30FF])/g,
      "$1 $2",
    );
    // 在 「I said:it's a good news」的冒号与英文之间加入空格 「I said: it's a good news」
    content = content.replace(/([:])\s*([a-zA-z])/g, "$1 $2");
    return content;
  }
  replacePunctuations(content: string) {
    // `, \ . : ; ? !` 改成 `，、。：；？！`

    //... 替换为中文省略号  add
    content = content.replace(/[.]{3,}/g, "……");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF]),/g, "$1，");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF]);/g, "$1；");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF]):/g, "$1：");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF])!/g, "$1！");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF])\?/g, "$1？");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF])\\/g, "$1、");
    content = content.replace(/([\u4e00-\u9fa5\u3040-\u30FF])＼s*\:/g, "$1：");

    // 不包含引用块才换
    if (!/`.*?`/.test(content)) {
      //先把分号换成引号
      content = content.replace(/"(.*?)"/g, "“$1”");
    }

    // 簡體中文使用直角引號
    // 这里处理后，后面会根据引号是否在英文上下文中替换回英文引号
    content = content.replace(/‘/g, "『");
    content = content.replace(/’/g, "』");
    content = content.replace(/“/g, "「");
    content = content.replace(/”/g, "」");

    // 必须在结尾或者有空格的点才被改成句号
    content = content.replace(
      /([\u4e00-\u9fa5\u3040-\u30FF」，。！？：])\.($|\s*)/g,
      "$1。",
    );

    // content = content.replace(/“(.*?[\u4e00-\u9fa5\u3040-\u30FF])”/g, "「$1」");
    // content = content.replace(/“([\u4e00-\u9fa5\u3040-\u30FF].*?)”/g, "「$1」");

    content = content.replace(
      /（([!@#$%^&*()_+-=\[\]{};':"./<>【】「」《》]*\w.*?[!@#$%^&*()_+-=\[\]{};':"./<>]*)）/g,
      " ($1) ",
    );

    content = content.replace(
      /([\u4e00-\u9fa5\u3040-\u30FF，。、《》？『』「」；：【】｛｝—！＠￥％…（）])\s*\((.*?)\)/g,
      "$1（$2）",
    );
    //fix 20240507 不匹配 [hello](https://leay.net)哈哈
    content = content.replace(
      /(?<![\])])\((.*?)\)\s*([\u4e00-\u9fa5\u3040-\u30FF，。、《》？『』「」；：【】｛｝—！＠￥％…（）])/g,
      "（$1）$2",
    );

    // (my 我的)
    // (我的 milk)
    content = content.replace(
      /\((.*?[\u4e00-\u9fa5\u3040-\u30FF])\)/g,
      "（$1）",
    );
    content = content.replace(
      /\(([\u4e00-\u9fa5\u3040-\u30FF].*?)\)/g,
      "（$1）",
    );
    // 英文和数字内部的全角标点 `，。；‘’“”：？！＠＃％＆－＝＋｛｝【】｜＼～`改成半角标点
    content = content.replace(/(\w)\s*，\s*(\w)/g, "$1, $2");
    content = content.replace(/(\w)\s*。\s*(\w)/g, "$1. $2");
    content = content.replace(/(\w)\s*。\s*(”)/g, "$1. $2");
    content = content.replace(/(\w)\s*；\s*(\w)/g, "$1; $2");
    // content = content.replace(/(\w)\s*：\s*(\w)/g, "$1: $2");
    content = content.replace(/(\w)\s*：\s*/g, "$1: ");
    content = content.replace(/(\w)\s*？\s*(\w)/g, "$1? $2");
    content = content.replace(/(\w)\s*！\s*(\w)/g, "$1! $2");
    content = content.replace(/(\w)\s*＠\s*(\w)/g, "$1@$2");
    content = content.replace(/(\w)\s*＃\s*(\w)/g, "$1#$2");
    content = content.replace(/(\w)\s*％\s*(\w)/g, "$1 % $2");
    content = content.replace(/(\w)\s*＆\s*(\w)/g, "$1 & $2");
    content = content.replace(/(\w)\s*－\s*(\w)/g, "$1 - $2");
    content = content.replace(/(\w)\s*＝\s*(\w)/g, "$1 = $2");
    content = content.replace(/(\w)\s*＋\s*(\w)/g, "$1 + $2");
    content = content.replace(/(\w)\s*｛\s*(\w)/g, "$1 {$2");
    content = content.replace(/(\w)\s*｝\s*(\w)/g, "$1} $2");
    // 不包含引用块才换避免 plugins[name].setting => plugins [name].setting
    if (!/`.*?`/.test(content)) {
      content = content.replace(/(\w)\s*[【\[]\s*(\w)/g, "$1 [$2");
    }
    content = content.replace(/(\w)\s*[】\]]\s*(\w)/g, "$1] $2");
    content = content.replace(/(\w)\s*｜\s*(\w)/g, "$1 | $2");
    content = content.replace(/(\w)\s*＼\s*(\w)/g, "$1  $2");
    content = content.replace(/(\w)\s*～\s*(\w)/g, "$1~$2");

    content = content.replace(
      /(\w[:;,.!?\'\"’]?[:;,.!?\'\"’]?)\s*「\s*(\w)/g,
      "$1 “$2",
    );
    content = content.replace(
      /(\w[:;,.!?\'\"’]?[:;,.!?\'\"’]?)\s*『\s*(\w)/g,
      "$1 ‘$2",
    );
    content = content.replace(/(\w[:;,.!?\'\"’]?[:;,.!?\'\"’]?)\s*』/g, "$1’");

    content = content.replace(/(\w[,.!?]?)\s*」\s*([「]?\w?)/g, "$1” $2");
    content = content.replace(/(\w)\s*『\s*(\w)/g, "$1‘f$2");
    content = content.replace(/(\w)\s*』\s*(\w)/g, "$1’$2");

    content = content.replace(/(\w)\s*『\s*(\w)/g, "$1‘f$2");
    content = content.replace(/(\w)\s*』\s*(\w)/g, "$1’$2");

    content = content.replace(/(\b\w+')\s(\w*\b)/g, "$1$2");

    content = content.replace(/「(.*?)"/g, "「$1」");
    content = content.replace(/「(.*?)”/g, "「$1」");
    content = content.replace(/"(.*?)」/g, "「$1」");
    //20240414 fix bug：将 “fact” 「哈哈」 也匹配了
    // content = content.replace(/“(\w.*?\w?)」/g, "“$1”");
    content = content.replace(
      /“(\w.*?\w[:;,.!?\'\"’]?[:;,.!?\'\"’]?)」/g,
      "“$1”",
    );
    content = content.replace(
      /“(\w.*?\w[:;,.!?\'\"’]?[:;,.!?\'\"’]?)。」/g,
      "“$1.”",
    );
    content = content.replace(/'(\w.*?\w)”/g, "“$1”");
    // 过滤一下 <div id = ""

    content = content.replace(/(\w)'(\w)?/g, "$1’$2");

    content = content.replace(/\s*「(\w.*?\w[,.!?]?)」\s*/g, "“$1” ");
    content = content.replace(
      /\s*「(\w.*?\w[:;,.!?’\)]?[:;,.!?’\)]?)」\s*/g,
      "“$1” ",
    );
    content = content.replace(/“(\w)」/g, "“$1”");
    content = content.replace(/「(\w)”/g, "“$1”");

    //中英文混排使用全角引号和括号
    content = content.replace(
      /([\u4e00-\u9fa5\u3040-\u30FF，。、《》？『』「」；：【】｛｝—！＠￥％…（）])\s*“(.*?)”/g,
      "$1「$2」",
    );
    content = content.replace(
      /“(.*?)”\s*([\u4e00-\u9fa5\u3040-\u30FF，。、《》？『』「」；：【】｛｝—！＠￥％…（）])/g,
      "「$1」$2",
    );
    content = content.replace("「📌」", '"📌"');

    //  content = content.replace(/(「.*?」)./g, "$1。");

    content = content.replace(/”\s*([,.!?]\1?)/g, "”$1");

    // 连续三个以上的 `。` 改成 `......`
    content = content.replace(/[。]{3,}/g, "……");

    // 截断连续超过一个的 ？和！ 为一个，「！？」也算一个
    content = content.replace(/([！？]+)\1{1,}/g, "$1");
    // 截断连续超过一个的 。，；：、“”『』〖〗《》 为一个
    content = content.replace(/([。，；：、“”『』〖〗《》【】])\1{1,}/g, "$1");
    // content = content.replace(
    //   /\{\s*:\s*id\s*=\s*“(.*?)”\s*updated\s*=\s*“(.*?)”\s*\}/g,
    //   '{: id="$1" updated="$2"}'
    // );
    // content = content.replace(
    //   /\{\s*:\s*updated\s*=\s*“(.*?)”\s*id\s*=\s*“(.*?)”\s*\}/g,
    //   '{: id="$1" updated="$2"}'
    // );
    //todo
    // content = content.replace(/updated\s*=\s*“(.*?)”/g, 'updated="$1"');
    // content = content.replace(/id\s*=\s*“(.*?)”/g, 'id="$1"');
    // content = content.replace(/(updated=".*")\s*\}/g, "$1}");
    // content = content.replace(/(id=".*")\s*\}/g, "$1}");

    content = content.replace(
      /「([^「」]*?)「([^「」]*?)」([^「」]*?)」/g,
      "「$1『$2』$3」",
    );

    content = content.replace(/\*\*(.*?)\s*\*\*/g, "**$1**");
    //20240414 bug：思源getKarmadowm 获取的内容「**」后会多带一个空格
    content = content.replace(/\*\*(.*?)\s*\*\*\s+/g, "**$1** ");
    content = content.replace(/\s+\*\*(.*?)\s*\*\*/g, " **$1**");

    // content = content.replace(/\*\*(.*?)\s*\*\*/g, "**$1**");

    //for me
    content = content.replaceAll("** **", " ");
    content = content.replaceAll("****", " ");

    // 英文标点替换为中文标点；先只启用逗号，其他标点符号遇到再说。
    content = content.replace(/,([\u4e00-\u9fa5\u3040-\u30FF])/g, "，$1");
    // content = content.replace(/\.([\u4e00-\u9fa5\u3040-\u30FF])/g, "。$1");
    // content = content.replace(/\?([\u4e00-\u9fa5\u3040-\u30FF])/g, "？$1");
    // content = content.replace(/!([\u4e00-\u9fa5\u3040-\u30FF])/g, "！$1");
    // content = content.replace(/;([\u4e00-\u9fa5\u3040-\u30FF])/g, "；$1");
    // content = content.replace(/:([\u4e00-\u9fa5\u3040-\u30FF])/g, "：$1");
    // content = content.replace(/\(([\u4e00-\u9fa5\u3040-\u30FF])/g, "（$1");
    // content = content.replace(/\)([\u4e00-\u9fa5\u3040-\u30FF])/g, "）$1");
    // content = content.replace(/\{([\u4e00-\u9fa5\u3040-\u30FF])/g, "｛$1");
    // content = content.replace(/\}([\u4e00-\u9fa5\u3040-\u30FF])/g, "｝$1");
    // content = content.replace(/\[(\u4e00-\u9fa5\u3040-\u30FF])/g, "【$1");
    // content = content.replace(/\](\u4e00-\u9fa5\u3040-\u30FF])/g, "】$1");
    // content = content.replace(/\<([\u4e00-\u9fa5\u3040-\u30FF])/g, "《$1");
    // content = content.replace(/\>([\u4e00-\u9fa5\u3040-\u30FF])/g, "》$1");

    //end for me
    standardNames.forEach((ele: any) => {
      content = content.replace(ele.key, ele.value);
    });

    //console.log("end");
    //console.log(content);

    return content;
    // let lines = content.split("\n");
    // for (let index = 0; index < lines.length; index++) {
    //   lines[index] = lines[index].trim();
    // }
    // return lines.join("\n");
  }
  replaceFullNumbersAndChars(content: string) {
    // 替换全角数字 & 全角英文
    // Ａ -> A
    // ０ -> 0
    return content.replace(/[\uFF10-\uFF19\uFF21-\uFF5A]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
  }
  cleanSpacesBetweenChineseCharacters = (text: string) => {
    return (
      text
        // 只合并连续的空格和制表符，不影响换行
        // 第一行：移除中文字符之间的空格
        .replace(/(?<=[\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, "")

        // 第二行：将多个连续空格合并为单个空格
        .replace(/ +/g, " ")
    );
  };
  formatContent(content: string) {
    // 替换所有的全角数字和字母为半角
    content = this.replaceFullNumbersAndChars(content);
    // 删除多余的内容（回车）
    content = this.condenseContent(content);

    // 每行操作
    const lines = content.split("\n");
    const ignoreBlocks = this.getIgnoreBlocks(lines);
    content = lines
      .map((line, index) => {
        // 忽略代码块
        if (
          ignoreBlocks.some(({ start, end }) => {
            return index >= start && index <= end;
          })
        ) {
          return line;
        }
        //中文文档内的英文标点替换为中文标点
        line = this.replacePunctuations(line);
        // 将无编号列表的“* ”改成 “- ”
        // 将无编号列表的“- ”改成 “- ”
        line = line.replace(/^(\s*)[-\*]\s+(\S)/, "$1- $2");
        // 删除多余的空格
        line = this.deleteSpaces(line);
        // 插入必要的空格
        line = this.insertSpace(line);
        // 将有编号列表的“1.  ”改成 “1. ”
        line = line.replace(/^(\s*)(\d\.)\s+(\S)/, "$1$2 $3");

        return line;
      })
      .join("\n");
    // 结束文档整理前再删除最后一个回车
    content = content.replace(/(\n){2,}$/g, "$1");
    content = content.replace(/(\r\n){2,}$/g, "$1");
    return content;
  }
}

export let formatUtil = new FormatUtil();
