const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SERVER_URL = process.env.GREEND_SERVER_URL || 'http://localhost:3001';
const ICON_PATH = path.join(__dirname, 'assets', 'greend_logo.png');
const CONFIG_FILENAME = 'server.json';

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function normalizeServerUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error('Server URL is empty.');
  }

  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Server URL must start with http:// or https://.');
  }

  return url.toString().replace(/\/$/, '');
}

function readServerUrl() {
  const configPath = getConfigPath();

  if (process.env.GREEND_SERVER_URL) {
    return normalizeServerUrl(process.env.GREEND_SERVER_URL);
  }

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  return normalizeServerUrl(parsed.serverUrl || '');
}

function writeServerUrl(serverUrl) {
  const normalized = normalizeServerUrl(serverUrl);
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({ serverUrl: normalized }, null, 2)}\n`, 'utf8');
  return normalized;
}

function getBootstrapServerUrl() {
  try {
    return readServerUrl() || normalizeServerUrl(DEFAULT_SERVER_URL);
  } catch {
    return normalizeServerUrl(DEFAULT_SERVER_URL);
  }
}

function buildSetupHtml(initialUrl, message = '') {
  const escapedUrl = initialUrl
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  const escapedMessage = message
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>GreenD Setup</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: linear-gradient(160deg, #0f172a 0%, #1f2937 100%);
          color: #e5e7eb;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          width: min(560px, calc(100vw - 48px));
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        }
        h1 {
          margin: 0 0 8px;
          font-size: 28px;
        }
        p {
          margin: 0 0 20px;
          color: #cbd5e1;
          line-height: 1.5;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #cbd5e1;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 15px;
          background: #020617;
          color: #f8fafc;
          outline: none;
        }
        input:focus {
          border-color: #38bdf8;
        }
        .message {
          min-height: 22px;
          margin: 10px 0 0;
          font-size: 13px;
          color: #fca5a5;
        }
        button {
          margin-top: 18px;
          width: 100%;
          border: 0;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 15px;
          font-weight: 700;
          background: #f8fafc;
          color: #0f172a;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Connect GreenD</h1>
        <p>Enter the GreenD server URL provided by your company IT team. Example: <code>https://greend.company.internal</code></p>
        <label for="server-url">Server URL</label>
        <input id="server-url" value="${escapedUrl}" placeholder="https://greend.company.internal" autofocus />
        <div id="message" class="message">${escapedMessage}</div>
        <button id="save-button">Save and Open GreenD</button>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        const input = document.getElementById('server-url');
        const message = document.getElementById('message');
        const button = document.getElementById('save-button');

        async function submit() {
          button.disabled = true;
          message.textContent = '';
          const result = await ipcRenderer.invoke('save-server-url', input.value);
          if (!result.ok) {
            message.textContent = result.error;
            button.disabled = false;
            return;
          }
        }

        button.addEventListener('click', submit);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') submit();
        });
      </script>
    </body>
  </html>`;
}

function openSetupWindow(message = '') {
  const setupWindow = new BrowserWindow({
    width: 640,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'GreenD Setup',
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildSetupHtml(getBootstrapServerUrl(), message))}`);
}

function createMainWindow(serverUrl) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    show: false,
    title: 'GreenD',
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-fail-load', () => {
    dialog.showErrorBox(
      'GreenD Connection Error',
      `Could not open ${normalizedServerUrl}. Check that the company server is running and reachable.`
    );
  });

  win.loadURL(normalizedServerUrl);
}

ipcMain.handle('save-server-url', async (_event, value) => {
  try {
    const serverUrl = writeServerUrl(value);
    BrowserWindow.getAllWindows().forEach(window => window.close());
    createMainWindow(serverUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(() => {
  let serverUrl = null;

  try {
    serverUrl = readServerUrl();
  } catch (error) {
    openSetupWindow(error.message);
    return;
  }

  if (!serverUrl) {
    openSetupWindow();
    return;
  }

  createMainWindow(serverUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextServerUrl = readServerUrl();
      if (nextServerUrl) createMainWindow(nextServerUrl);
      else openSetupWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
