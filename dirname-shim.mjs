// ES module shim to provide __dirname and __filename globals
// Required for vite.config.ts which uses __dirname but runs in ESM mode
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import process from 'node:process';

// Inject CommonJS-style globals into the global scope
globalThis.__dirname = process.cwd();
globalThis.__filename = fileURLToPath(import.meta.url);
