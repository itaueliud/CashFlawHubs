#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const desiredMemory = process.env.NODE_MAX_OLD_SPACE_SIZE || '4096';
const hasMemoryFlag = (process.execArgv || []).some((arg) => arg.startsWith('--max-old-space-size'));
if (!hasMemoryFlag) {
  const childArgs = [`--max-old-space-size=${desiredMemory}`, ...process.execArgv, path.resolve(__dirname, 'start.js'), ...process.argv.slice(2)];
  const child = spawnSync(process.execPath, childArgs, {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NODE_MAX_OLD_SPACE_SIZE: desiredMemory },
  });
  process.exit(child.status || 0);
}

function ensureDep(pkg) {
  try {
    require.resolve(pkg);
    return true;
  } catch (e) {
    return false;
  }
}

if (!ensureDep('speakeasy')) {
  console.log('Missing backend dependency detected (speakeasy). Running `npm install` in backend...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: path.resolve(__dirname) });
  } catch (err) {
    console.error('Failed to install backend dependencies:', err);
    process.exit(1);
  }
}

// Launch the server with increased memory like before
const serverPath = path.resolve(__dirname, 'src', 'server.js');
require(serverPath);
