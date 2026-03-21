require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  const client = await pool.connect();
  try {
    // List all schemas
    const schemas = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`
    );
    console.log('\n=== Schemas ===');
    schemas.rows.forEach(r => console.log(' -', r.schema_name));

    // List all tables across all schemas
    const tables = await client.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name`
    );
    console.log('\n=== Tables ===');
    if (tables.rows.length === 0) {
      console.log(' (no tables found — database may be empty)');
    } else {
      tables.rows.forEach(r => console.log(` - ${r.table_schema}.${r.table_name}`));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

inspect().catch(err => console.error('\nConnection error:', err.message));
