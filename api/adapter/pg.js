// Adapter PostgreSQL: meniru antarmuka Cloudflare D1 (env.DB.prepare().bind().first()/.all()/.run())
// agar src/index.js TIDAK perlu diubah. Menerima `pool` apa pun yang punya .query(text, params).
//
// Dua penyesuaian dialek (otomatis, tak menyentuh kode aplikasi):
//   1) placeholder  ?         ->  $1, $2, ...   (gaya PostgreSQL)
//   2) datetime('now')        ->  now()
export function createPg(pool) {
  return {
    prepare(sql) {
      let i = 0;
      const text = sql
        .replace(/datetime\('now'\)/g, "now()")
        .replace(/\?/g, () => "$" + ++i);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() {
          const r = await pool.query(text, args);
          return r.rows[0] ?? null;
        },
        async all() {
          const r = await pool.query(text, args);
          return { results: r.rows };
        },
        async run() {
          const r = await pool.query(text, args);
          return { success: true, meta: { changes: r.rowCount ?? r.affectedRows ?? 0 } };
        },
      };
      return api;
    },
    _pool: pool,
  };
}
