import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'node:url';
import {defineConfig, loadEnv} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function basicAuthPlugin(password) {
  if (!password) {
    return null;
  }

  const realm = 'LHB Markup Platform';

  const middleware = (req, res, next) => {
    const header = String(req.headers.authorization || '');
    if (header.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        const suppliedPassword = separator >= 0 ? decoded.slice(separator + 1) : '';
        if (suppliedPassword === password) {
          next();
          return;
        }
      } catch {
        // Fall through to challenge.
      }
    }

    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    res.end('Authentication required');
  };

  return {
    name: 'lhb-markup-basic-auth',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const authPassword = env.LHB_MARKUP_BASIC_AUTH_PASSWORD?.trim();

  return {
    plugins: [basicAuthPlugin(authPassword), react(), tailwindcss()].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
  };
});
