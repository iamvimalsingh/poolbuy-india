import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [,, key, configFile] = process.argv;
if (!key || !configFile) {
  console.error('Usage: node scratch/set-secret.mjs <KEY> <CONFIG_FILE>');
  process.exit(1);
}

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
if (!match) {
  console.error(`Key ${key} not found in .env.local`);
  process.exit(1);
}
const value = match[1].trim();

const proc = spawn('npx', ['wrangler', 'secret', 'put', key, '--config', configFile], {
  shell: true,
  stdio: ['pipe', 'inherit', 'inherit'],
});

proc.stdin.write(value);
proc.stdin.end();

proc.on('close', (code) => {
  if (code === 0) {
    console.log(`Successfully configured secret: ${key}`);
  } else {
    console.error(`Failed to configure secret: ${key} (exit code ${code})`);
    process.exit(code ?? 1);
  }
});
