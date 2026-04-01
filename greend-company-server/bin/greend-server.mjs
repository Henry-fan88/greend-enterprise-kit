#!/usr/bin/env node

import { access, copyFile, mkdir, readFile, stat, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(projectRoot, '.env.example');
const envPath = path.join(projectRoot, '.env');
const distIndexPath = path.join(projectRoot, 'dist', 'index.html');

function parseArgs(argv) {
  const positionals = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    const key = rawKey.trim();
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { positionals, flags };
}

async function exists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function applyEnvValue(content, key, value) {
  const escaped = String(value).replaceAll('\\', '\\\\');
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const nextLine = `${key}=${escaped}`;
  return pattern.test(content) ? content.replace(pattern, nextLine) : `${content.trimEnd()}\n${nextLine}\n`;
}

async function initCommand(flags) {
  if (!(await exists(envPath))) {
    await copyFile(envExamplePath, envPath);
  }

  let envContent = await readFile(envPath, 'utf8');
  const dataDir = flags['data-dir'] || path.join(process.cwd(), 'greend-data');
  const adminUser = flags['admin-user'] || 'admin';
  const adminPassword = flags['admin-password'] || 'ChangeMe123!';
  const sessionSecret = flags['session-secret'] || randomSecret();
  const host = flags.host || '0.0.0.0';
  const port = flags.port || '3001';
  const cookieSecure = String(flags['cookie-secure'] || 'false');

  envContent = applyEnvValue(envContent, 'GREEND_DATA_DIR', dataDir);
  envContent = applyEnvValue(envContent, 'DEFAULT_ADMIN_USERNAME', adminUser);
  envContent = applyEnvValue(envContent, 'DEFAULT_ADMIN_PASSWORD', adminPassword);
  envContent = applyEnvValue(envContent, 'SESSION_SECRET', sessionSecret);
  envContent = applyEnvValue(envContent, 'HOST', host);
  envContent = applyEnvValue(envContent, 'PORT', port);
  envContent = applyEnvValue(envContent, 'COOKIE_SECURE', cookieSecure);

  await mkdir(dataDir, { recursive: true });
  await writeFile(envPath, envContent, 'utf8');

  console.log(`Wrote ${envPath}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Default admin username: ${adminUser}`);
}

async function doctorCommand() {
  const checks = [
    ['.env', envPath],
    ['dist build', distIndexPath],
  ];

  for (const [label, targetPath] of checks) {
    const ok = await exists(targetPath);
    console.log(`${ok ? 'OK' : 'MISSING'} ${label}: ${targetPath}`);
  }

  if (await exists(envPath)) {
    const envContent = await readFile(envPath, 'utf8');
    const dataDirMatch = envContent.match(/^GREEND_DATA_DIR=(.*)$/m);
    if (dataDirMatch?.[1]) {
      console.log(`Configured data directory: ${dataDirMatch[1]}`);
    }
  }
}

async function startCommand() {
  const child = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const command = positionals[0] || 'help';

  if (command === 'init') {
    await initCommand(flags);
    return;
  }

  if (command === 'doctor') {
    await doctorCommand();
    return;
  }

  if (command === 'start') {
    await startCommand();
    return;
  }

  console.log(`GreenD Server CLI

Commands:
  greend-server init [--data-dir /srv/greend/data] [--admin-user admin] [--admin-password secret] [--host 0.0.0.0] [--port 3001]
  greend-server doctor
  greend-server start`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
