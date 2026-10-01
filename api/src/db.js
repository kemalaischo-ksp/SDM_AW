// Pool PostgreSQL + helper query.
import pg from "pg";

// NUMERIC (oid 1700) sebagai number, DATE (1082) tetap string ISO.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);

export function createPool(connectionString) {
  return new pg.Pool({ connectionString, max: 10 });
}

export const q = (pool) => (text, params) => pool.query(text, params);
