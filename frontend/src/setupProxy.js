const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Dev server middleware that mimics Vercel's cleanUrls behavior.
 * If a request path matches a .html file in public/, serve it
 * instead of falling through to the SPA catch-all.
 */
module.exports = function (app) {
  app.use((req, res, next) => {
    // Skip API calls, static assets, and the root path (React app)
    if (req.path === '/' || req.path.includes('.')) {
      return next();
    }

    const htmlFile = path.join(PUBLIC_DIR, `${req.path}.html`);
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }

    next();
  });
};
