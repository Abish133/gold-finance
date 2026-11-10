import { query } from './src/config/db.js';
const r = await query(process.argv[2]); console.table(r); process.exit(0);
