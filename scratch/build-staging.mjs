import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: 'https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev',
  NEXT_PUBLIC_DEMO_MODE: 'false',
};

const res = spawnSync('npm', ['run', 'build:worker'], {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(res.status ?? 0);
