function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 先转义再套用行内标记，保证笔记内容不会注入 HTML。
function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>");
}

export function renderMarkdown(source: string) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let listType = "";
  let paragraph: string[] = [];

  function closeParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  }

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      closeParagraph();
      closeList();
      return;
    }
    const heading = text.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      return;
    }
    if (/^([-*_])\1{2,}$/.test(text)) {
      closeParagraph();
      closeList();
      html.push("<hr />");
      return;
    }
    const quote = text.match(/^>\s?(.*)$/);
    if (quote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      return;
    }
    const unordered = text.match(/^[-*+]\s+(.*)$/);
    if (unordered) {
      closeParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      return;
    }
    const ordered = text.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      closeParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      return;
    }
    closeList();
    paragraph.push(text);
  });

  closeParagraph();
  closeList();
  return html.join("");
}
