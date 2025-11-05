const fs = require('fs');
const path = require('path');

// Copy compiled handlers to separate directories for Lambda deployment
const handlers = [
  'lead-intake',
  'ai-scoring',
  'lead-matching',
  'marketplace',
  'payment',
  'agent-management',
  'admin'
];

const distDir = path.join(__dirname, '..', 'dist');
const utilsSource = path.join(distDir, 'utils');

handlers.forEach(handler => {
  const handlerDir = path.join(distDir, handler);
  if (!fs.existsSync(handlerDir)) {
    fs.mkdirSync(handlerDir, { recursive: true });
  }
  
  // Copy handler file
  const handlerSource = path.join(distDir, 'handlers', `${handler}.js`);
  const handlerDest = path.join(handlerDir, 'index.js');
  if (fs.existsSync(handlerSource)) {
    fs.copyFileSync(handlerSource, handlerDest);
  }
  
  // Copy utils
  const utilsDest = path.join(handlerDir, 'utils');
  if (fs.existsSync(utilsSource) && !fs.existsSync(utilsDest)) {
    fs.mkdirSync(utilsDest, { recursive: true });
    fs.readdirSync(utilsSource).forEach(file => {
      fs.copyFileSync(
        path.join(utilsSource, file),
        path.join(utilsDest, file)
      );
    });
  }
});

console.log('✅ Handlers copied successfully');
