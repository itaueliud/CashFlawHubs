const { spawn } = require('child_process');
const path = require('path');

console.log('Starting seed script...\n');

const seedProcess = spawn('node', ['scripts/seed.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

seedProcess.on('close', (code) => {
  console.log(`\nSeed process exited with code ${code}`);
  process.exit(code);
});

seedProcess.on('error', (err) => {
  console.error('Failed to start seed process:', err);
  process.exit(1);
});
