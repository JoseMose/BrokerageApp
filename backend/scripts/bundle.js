const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const handlers = [
  'lead-intake',
  'ai-scoring',
  'lead-matching',
  'marketplace',
  'payment',
  'agent-management',
  'admin',
  // Lead locking system handlers
  'lock-lead',
  'unlock-lead',
  'claim-lead',
  'cleanup-expired-locks',
  // Public lead generation
  'create-lead',
  // Bulk packages
  'bulk-packages',
  // AI Recommendations (daily 8 AM only)
  'ai-recommendations',
  // Feedback & ratings
  'feedback',
  // Cognito triggers
  'pre-signup',
  'post-signup'
];

const distDir = path.join(__dirname, '..', 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

async function bundleHandler(handler) {
  const handlerDir = path.join(distDir, handler);
  fs.mkdirSync(handlerDir, { recursive: true });
  
  // Check for both .ts and .js files
  const tsFile = path.join(__dirname, '..', 'src', 'handlers', `${handler}.ts`);
  const jsFile = path.join(__dirname, '..', 'src', 'handlers', `${handler}.js`);
  
  let entryFile;
  if (fs.existsSync(tsFile)) {
    entryFile = tsFile;
  } else if (fs.existsSync(jsFile)) {
    entryFile = jsFile;
  } else {
    throw new Error(`Handler file not found: ${handler}.ts or ${handler}.js`);
  }
  
  const outFile = path.join(handlerDir, 'index.js');
  
  try {
    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: outFile,
      external: ['@aws-sdk/*'],
      sourcemap: true,
      minify: false,
      format: 'cjs',
    });
    
    console.log(`✅ Bundled ${handler}`);
  } catch (error) {
    console.error(`❌ Failed to bundle ${handler}:`, error);
    throw error;
  }
}

async function main() {
  console.log('📦 Bundling Lambda handlers...');
  
  for (const handler of handlers) {
    await bundleHandler(handler);
  }
  
  console.log('✅ All handlers bundled successfully');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
