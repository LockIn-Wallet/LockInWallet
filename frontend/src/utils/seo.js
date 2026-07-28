// Per-route SEO for the single-page app.
//
// index.html carries the site-wide tags, which describe the landing page. A
// route that is its own document — the prize pool page, the visualiser — has
// to rewrite them on mount and put them back on unmount, otherwise the tags
// left behind describe the wrong page to whatever crawls or shares it next.

export const SITE_URL = "https://lockinwallet.com";

/** Route path -> absolute canonical URL. */
export const absoluteUrl = (path = "/") =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`.replace(/\/+$/, "") ||
  SITE_URL;

// Sets an attribute and records how to undo it: restore the old value when the
// tag came from index.html, remove the tag when we created it ourselves.
const setAttribute = (element, attribute, value, undos) => {
  const previous = element.getAttribute(attribute);
  undos.push(() => element.setAttribute(attribute, previous));
  element.setAttribute(attribute, value);
};

const upsertTag = (tagName, keyAttribute, keyValue, valueAttribute, value, undos) => {
  const selector = `${tagName}[${keyAttribute}="${keyValue}"]`;
  const existing = document.head.querySelector(selector);

  if (existing) {
    setAttribute(existing, valueAttribute, value, undos);
    return;
  }

  const created = document.createElement(tagName);
  created.setAttribute(keyAttribute, keyValue);
  created.setAttribute(valueAttribute, value);
  document.head.appendChild(created);
  undos.push(() => created.remove());
};

const setMeta = (keyAttribute, keyValue, content, undos) =>
  upsertTag("meta", keyAttribute, keyValue, "content", content, undos);

const setJsonLd = (jsonLd, undos) => {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
  undos.push(() => script.remove());
};

/**
 * Point the document's SEO tags at one route.
 *
 * @param {object} seo
 * @param {string} seo.title       document title and og/twitter title
 * @param {string} seo.description meta description, shared with og/twitter
 * @param {string} seo.path        route path, turned into the canonical URL
 * @param {object} [seo.jsonLd]    structured data appended as ld+json
 * @returns {Function} restores every tag to what it was before the call
 */
export const applyPageSeo = ({ title, description, path, jsonLd }) => {
  const undos = [];
  const url = absoluteUrl(path);

  const previousTitle = document.title;
  undos.push(() => {
    document.title = previousTitle;
  });
  document.title = title;

  setMeta("name", "description", description, undos);
  setMeta("property", "og:title", title, undos);
  setMeta("property", "og:description", description, undos);
  setMeta("property", "og:url", url, undos);
  setMeta("name", "twitter:title", title, undos);
  setMeta("name", "twitter:description", description, undos);
  upsertTag("link", "rel", "canonical", "href", url, undos);

  if (jsonLd) setJsonLd(jsonLd, undos);

  // Undo in reverse so a tag touched twice ends on its original value
  return () => undos.reverse().forEach((undo) => undo());
};

/** Schema.org FAQPage node, ready to nest in an @graph or stand alone. */
export const buildFaqJsonLd = (faq) => ({
  "@type": "FAQPage",
  mainEntity: faq.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
});
