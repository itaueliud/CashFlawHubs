#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

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
