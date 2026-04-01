import express from 'express';
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const session = require('express-session');

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = resolve(process.env.GREEND_DATA_DIR || join(__dirname, 'data'));
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const DEFAULT_ADMIN_USERNAME = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required. Copy .env.example to .env and set a real secret.');
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Generic helpers for simple single-file read/write
async function readJson(relPath, fallback) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, relPath), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(relPath, payload) {
  const fullPath = join(DATA_DIR, relPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, JSON.stringify(payload, null, 2));
}

// User profile helpers
async function readUsers() {
  return readJson('user_profile/users.json', []);
}

async function writeUsers(users) {
  await writeJson('user_profile/users.json', users);
}

// ESG data: read all esg/{year}.json files and merge into a single EsgData[] array
async function readEsgData() {
  let files;
  try {
    files = (await readdir(join(DATA_DIR, 'esg'))).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  if (files.length === 0) return [];

  const allYearData = await Promise.all(
    files.sort().map(f =>
      readFile(join(DATA_DIR, 'esg', f), 'utf8').then(JSON.parse)
    )
  );

  // Merge records by id — shared metadata takes the latest value;
  // yearlyValues and lastModifiedBy are accumulated across all year files.
  const byId = new Map();
  for (const yearRecords of allYearData) {
    for (const record of yearRecords) {
      if (!byId.has(record.id)) {
        byId.set(record.id, { ...record, yearlyValues: {}, lastModifiedBy: [] });
      }
      const m = byId.get(record.id);
      // Shared metadata — all year files should carry the same values; last file wins
      m.parentId   = record.parentId;
      m.category   = record.category;
      m.section    = record.section;
      m.scope      = record.scope;
      m.unit       = record.unit;
      m.department = record.department;
      // Year-specific data
      Object.assign(m.yearlyValues, record.yearlyValues);
      m.lastModifiedBy.push(...record.lastModifiedBy);
    }
  }

  return Array.from(byId.values());
}

// ESG data: split a full EsgData[] array and write one file per year
async function writeEsgData(records) {
  await mkdir(join(DATA_DIR, 'esg'), { recursive: true });

  // Collect every year referenced in values or change history
  const years = new Set();
  for (const r of records) {
    for (const y of Object.keys(r.yearlyValues)) years.add(Number(y));
    for (const c of r.lastModifiedBy) years.add(c.year);
  }

  for (const year of [...years].sort()) {
    const yearRecords = records
      .filter(r => year in r.yearlyValues || r.lastModifiedBy.some(c => c.year === year))
      .map(r => ({
        ...r,
        yearlyValues: year in r.yearlyValues ? { [year]: r.yearlyValues[year] } : {},
        lastModifiedBy: r.lastModifiedBy.filter(c => c.year === year),
      }));
    await writeFile(
      join(DATA_DIR, 'esg', `${year}.json`),
      JSON.stringify(yearRecords, null, 2)
    );
  }
}

const DEFAULT_PREFS = {
  dashboardLayout: [
    { i: 'emissions', x: 0, y: 0, w: 6, h: 4 },
    { i: 'energy',    x: 6, y: 0, w: 6, h: 4 },
    { i: 'diversity', x: 0, y: 4, w: 6, h: 4 },
    { i: 'summary',   x: 6, y: 4, w: 6, h: 4 },
  ],
  dashboardPanels: ['emissions', 'energy', 'diversity', 'summary'],
  customPanelConfigs: {},
};

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  readUsers().then(users => {
    const user = users.find(u => u.id === req.session.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  }).catch(() => res.status(500).json({ error: 'Internal server error' }));
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dataDir: DATA_DIR,
    host: HOST,
    port: PORT,
  });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const users = await readUsers();
  const user = users.find(u => u.username === username.toLowerCase().trim());
  // Same error for missing user and wrong password to prevent username enumeration
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  req.session.userId = user.id;
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(204));
});

app.put('/api/auth/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const users = await readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(401).json({ error: 'Session invalid' });

  const valid = await bcrypt.compare(currentPassword, users[idx].passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  users[idx].passwordHash = await bcrypt.hash(newPassword, 12);
  await writeUsers(users);
  res.sendStatus(204);
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const users = await readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session invalid' });
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

// User management endpoints (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await readUsers();
  res.json(users.map(({ passwordHash, ...u }) => u));
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, username, password, role, department } = req.body;
  if (!name || !username || !password || !role || !department)
    return res.status(400).json({ error: 'Missing required fields' });

  const users = await readUsers();
  if (users.find(u => u.username === username.toLowerCase().trim()))
    return res.status(409).json({ error: 'Username already exists' });

  const newUser = {
    id: `u${Date.now()}`,
    name: name.trim(),
    username: username.toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    department,
    createdAt: new Date().toISOString(),
  };
  await writeUsers([...users, newUser]);
  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const { name, username, password, role, department } = req.body;
  const updated = { ...users[idx] };
  if (name)       updated.name = name.trim();
  if (username)   updated.username = username.toLowerCase().trim();
  if (role)       updated.role = role;
  if (department) updated.department = department;
  if (password)   updated.passwordHash = await bcrypt.hash(password, 12);

  const conflict = users.find((u, i) => i !== idx && u.username === updated.username);
  if (conflict) return res.status(409).json({ error: 'Username already exists' });

  users[idx] = updated;
  await writeUsers(users);
  const { passwordHash, ...safeUser } = updated;
  res.json(safeUser);
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.userId)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  const users = await readUsers();
  const filtered = users.filter(u => u.id !== req.params.id);
  if (filtered.length === users.length) return res.status(404).json({ error: 'User not found' });
  await writeUsers(filtered);
  res.sendStatus(204);
});

// Theme
app.get('/api/theme', requireAuth, async (req, res) => {
  res.json(await readJson('settings/theme.json', { font: 'Inter' }));
});
app.put('/api/theme', requireAuth, async (req, res) => {
  await writeJson('settings/theme.json', req.body);
  res.sendStatus(204);
});

// ESG Data
app.get('/api/data', requireAuth, async (req, res) => {
  res.json(await readEsgData());
});
app.put('/api/data', requireAuth, async (req, res) => {
  await writeEsgData(req.body);
  res.sendStatus(204);
});

// Audit Logs
app.get('/api/logs', requireAuth, async (req, res) => {
  res.json(await readJson('logs/audit.json', []));
});
app.put('/api/logs', requireAuth, async (req, res) => {
  await writeJson('logs/audit.json', req.body);
  res.sendStatus(204);
});

// Per-user Dashboard Preferences
app.get('/api/prefs/:userId', requireAuth, async (req, res) => {
  res.json(await readJson(`preferences/${req.params.userId}.json`, DEFAULT_PREFS));
});
app.put('/api/prefs/:userId', requireAuth, async (req, res) => {
  await writeJson(`preferences/${req.params.userId}.json`, req.body);
  res.sendStatus(204);
});

// Production: serve Vite build
if (process.env.NODE_ENV === 'production') {
  const DIST = join(__dirname, 'dist');
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(join(DIST, 'index.html')));
}

// Seed default admin account on first run
async function seedDefaultAdmin() {
  const users = await readUsers();
  if (users.length === 0) {
    if (!DEFAULT_ADMIN_PASSWORD) {
      throw new Error('DEFAULT_ADMIN_PASSWORD is required on first boot when no users exist.');
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    await writeUsers([{
      id: 'u1',
      name: 'Admin',
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      role: 'admin',
      department: 'Sustainability',
      createdAt: new Date().toISOString(),
    }]);
    console.log(`Default admin account created (username: ${DEFAULT_ADMIN_USERNAME})`);
  }
}

seedDefaultAdmin().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`GreenD server running on http://${HOST}:${PORT}`);
    console.log(`GreenD data directory: ${DATA_DIR}`);
  });
});
