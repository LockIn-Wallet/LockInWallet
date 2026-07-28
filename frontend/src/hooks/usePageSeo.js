import { useEffect } from "react";

import { applyPageSeo } from "../utils/seo.js";

/**
 * usePageSeo - rewrite the document's SEO tags for the mounted route and
 * restore the site-wide ones on unmount.
 *
 * Pass a module-level constant, not an object literal: a fresh object every
 * render would re-run the effect on every render.
 */
export const usePageSeo = (seo) => {
  useEffect(() => applyPageSeo(seo), [seo]);
};

export default usePageSeo;
