// Util pencatatan: feed aktivitas (UI) + audit (log sensitif).
export async function logActivity(pool, a) {
  await pool.query(
    `INSERT INTO activity (ts, tgl, aksi, type, col, nama, emp_id, unit, ket, by_user)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      a.ts ?? Date.now(),
      a.tgl || new Date().toISOString().slice(0, 10),
      a.aksi,
      a.type || "info",
      a.col || null,
      a.nama || null,
      a.empId || null,
      a.unit || null,
      a.ket || null,
      a.by || null,
    ]
  );
}

export async function logAudit(pool, entry) {
  await pool.query(
    `INSERT INTO audit_log (ts, user_id, username, aksi, rincian, ip, ua)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [Date.now(), entry.userId || null, entry.username || null, entry.aksi, entry.rincian || null, entry.ip || null, entry.ua || null]
  );
}
