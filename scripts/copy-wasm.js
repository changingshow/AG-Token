const fs = require('fs');
const path = require('path');

const sourceWasm = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const sourceJs = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.js');

const destDir = path.join(__dirname, '..', 'dist');
const destWasm = path.join(destDir, 'sql-wasm.wasm');
const destJs = path.join(destDir, 'sql-wasm.js');

// Ensure dist directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

try {
    fs.copyFileSync(sourceWasm, destWasm);
    fs.copyFileSync(sourceJs, destJs);
    console.log(`[Success] Copied sql-wasm.wasm and sql-wasm.js to dist/`);
} catch (err) {
    console.error(`[Error] Failed to copy files:`, err);
    process.exit(1);
}
