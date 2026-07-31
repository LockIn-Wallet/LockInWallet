const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const API_DIR = path.join(__dirname, '..', 'api');

/**
 * Runs a Vercel-style serverless handler on the CRA dev server, so the same
 * function file serves /api/* locally and in production.
 * @param {string} handlerPath Absolute path to the handler module
 */
const mountApiHandler = (app, handlerPath) => {
  const route = `/api/${path
    .relative(API_DIR, handlerPath)
    .replace(/\.js$/, '')
    .split(path.sep)
    .join('/')}`;

  app.all(route, (req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      req.body = raw;
      // Required fresh so edits to the handler take effect without a restart
      delete require.cache[handlerPath];
      require(handlerPath)(req, res).catch((error) => {
        console.error(`Dev API handler ${route} failed:`, error);
        res.status(500).json({ error: 'Handler failed' });
      });
    });
  });
};

/**
 * Recursively mounts every handler under api/.
 */
const mountApiDir = (app, dir) => {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mountApiDir(app, fullPath);
    } else if (entry.name.endsWith('.js')) {
      mountApiHandler(app, fullPath);
    }
  }
};

/**
 * Dev server middleware that mimics Vercel's cleanUrls behavior.
 * If a request path matches a .html file in public/, serve it
 * instead of falling through to the SPA catch-all.
 */
module.exports = function (app) {
  mountApiDir(app, API_DIR);

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
