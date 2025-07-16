export function sanitizeHTML(html, allowedTags = ['body','a','b','i','u','p','div','span','ul','ol','li','br','hr','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','button','input','label','form','select','option','textarea','img','svg','use','path']) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
  const allowed = new Set(allowedTags.map(t => t.toLowerCase()));

  let node = walker.currentNode;
  while (node) {
    const tag = node.tagName.toLowerCase();
    const next = walker.nextNode();
    if (node !== doc.body && !allowed.has(tag)) {
      node.remove();
    } else {
      [...node.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || /javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
    }
    node = next;
  }
  return doc.body.innerHTML;
}
