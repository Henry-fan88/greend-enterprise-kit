import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const input = process.argv[2];

function getUserDataDir() {
  if (process.env.GREEND_CONFIG_DIR) {
    return process.env.GREEND_CONFIG_DIR;
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'GreenD');
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'GreenD');
  }

  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'GreenD');
}

if (!input) {
  console.error('Usage: npm run set-server-url -- http://company-server:3001');
  process.exit(1);
}

let normalized;
try {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Server URL must start with http:// or https://');
  }
  normalized = url.toString().replace(/\/$/, '');
} catch (error) {
  console.error(`Invalid server URL: ${error.message}`);
  process.exit(1);
}

const configDir = getUserDataDir();
const configPath = path.join(configDir, 'server.json');

await mkdir(configDir, { recursive: true });
await writeFile(
  configPath,
  `${JSON.stringify({ serverUrl: normalized }, null, 2)}\n`,
  'utf8'
);

console.log(`Saved GreenD server URL to ${configPath}`);
