/**
 * Build script — bundles Express server and all handlers into dist/server.js
 * using esbuild (same transpiler as before; no type-checking, fast).
 */

const esbuild = require('esbuild');
const path    = require('path');
const fs      = require('fs');

const outDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'src', 'server.ts')],
  bundle:      true,
  platform:    'node',
  target:      'node20',
  outfile:     path.join(outDir, 'server.js'),
  sourcemap:   true,
  external: [
    // Node built-ins and packages that must not be bundled
    'express',
    'cors',
    '@ibm-cloud/cloudant',
    'ibm-cloud-sdk-core',
    '@anthropic-ai/sdk',
    'stripe',
    'twilio',
    'nodemailer',
    'jsonwebtoken',
    'jwks-rsa',
    'uuid',
    'dotenv',
  ],
  logLevel: 'info',
}).then(() => {
  console.log('✅ Server bundled → dist/server.js');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
