const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'd:\\ITC Huawei';
const tempDir = path.join(rootDir, 'deploy_temp');
const publicDir = path.join(tempDir, 'public');
const zipFile = path.join(rootDir, 'deploy_cpanel.zip');

console.log('Preparing deployment files...');

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(publicDir, { recursive: true });

// 1. Copy backend files
fs.copyFileSync(path.join(rootDir, 'backend', 'server.js'), path.join(tempDir, 'server.js'));
fs.copyFileSync(path.join(rootDir, 'backend', 'package.json'), path.join(tempDir, 'package.json'));
fs.copyFileSync(path.join(rootDir, 'backend', '.env'), path.join(tempDir, '.env'));

// 2. Copy frontend/dist into public
function copyFolder(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyFolder(path.join(rootDir, 'frontend', 'dist'), publicDir);

// 3. Compress using PowerShell Compress-Archive
console.log('Compressing to deploy_cpanel.zip...');
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipFile}' -Force"`, {
  stdio: 'inherit',
});

// Clean up temp
fs.rmSync(tempDir, { recursive: true, force: true });

const stats = fs.statSync(zipFile);
console.log(`Success! Created ${zipFile} (${(stats.size / 1024).toFixed(1)} KB)`);
