const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const apiBackupDir = path.join(rootDir, 'api_backup');
const configPath = path.join(rootDir, 'next.config.mjs');
const configBackupPath = path.join(rootDir, 'next.config.mjs.backup');

try {
  console.log('--- Starting static export compilation ---');

  // 1. Backup API directory
  if (fs.existsSync(apiDir)) {
    console.log('Backing up API routes...');
    fs.renameSync(apiDir, apiBackupDir);
  }

  // 2. Backup next.config.mjs and write static export version
  if (fs.existsSync(configPath)) {
    console.log('Creating temporary static configuration...');
    fs.copyFileSync(configPath, configBackupPath);
  }
  const staticConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};
export default nextConfig;
`;
  fs.writeFileSync(configPath, staticConfig);

  // 3. Run build
  console.log('Compiling static pages...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('Static pages compiled successfully into out/ directory!');

} catch (err) {
  console.error('Static build failed:', err.message);
  process.exit(1);
} finally {
  // 4. Restore API directory and config
  if (fs.existsSync(apiBackupDir)) {
    console.log('Restoring API routes...');
    fs.renameSync(apiBackupDir, apiDir);
  }
  if (fs.existsSync(configBackupPath)) {
    console.log('Restoring Next.js configuration...');
    fs.copyFileSync(configBackupPath, configPath);
    fs.unlinkSync(configBackupPath);
  }
  console.log('--- Cleanup complete ---');
}
