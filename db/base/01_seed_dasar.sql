-- SIM-HR AL WILDAN — Data Awal (PostgreSQL). Password demo: alwildan123 (GANTI!)
INSERT INTO units (id, nama, kode, alamat) VALUES
 (1,'SDIT Permata','SDIT','Jl. Pendidikan No. 10, Bandung'),
 (2,'SMPIT Insani','SMPIT','Jl. Pendidikan No. 12, Bandung'),
 (3,'SMAIT Cendekia','SMAIT','Jl. Pendidikan No. 14, Bandung'),
 (4,'TKIT Bina','TKIT','Jl. Pendidikan No. 8, Bandung');

INSERT INTO users (id, email, name, role, unit_id, password_hash) VALUES
 ('u-admin','admin@alwildan.sch.id','Master Admin','master_admin',NULL,'pbkdf2$50000$WgrekyzkpNG+BqeRFKyULA==$c42Qp+h3Voqed95HmwY3RGWbFsqlCi0xgJrokHi87gE='),
 ('u-hr','hr.insani@alwildan.sch.id','HR SMPIT Insani','hr_cabang',2,'pbkdf2$50000$/XvBpRerm4CcKBrRvK5eUg==$yzDYgX4j3eyNZvlsi9XdVFBl50wORKPv7ZIh1yDLjEA='),
 ('u-budi','budi.santoso@alwildan.sch.id','Budi Santoso, S.Pd','pegawai',2,'pbkdf2$50000$a6T10lnkBJSaI1KbSqKHUw==$9LiarpTy2umuCI4aauFDmLvPFegy6Tn0OvLN0cNnBVY=');

INSERT INTO employees (id, unit_id, user_id, nip, nama, jabatan, no_rekening, aktif) VALUES
 (1,2,'u-budi','198703212010','Budi Santoso, S.Pd','Guru Matematika','1234567890',1),
 (2,2,NULL,'199005122014','Siti Aminah, S.Pd','Guru Bahasa','2234567890',1),
 (3,1,NULL,'198811052012','Ahmad Fauzi','Staf TU','3234567890',1);

UPDATE employees SET thp_kotor=5884800, thp_bersih=5500000, total_tk_thr=384800, tk=184800, thr_bulan=200000,
  konfirmasi='Aktif 6 Juli 2026',
  cv_url='https://drive.google.com/file/d/11gWZWACTCmRXPhto4WZyUCpf6OQEbZTP/view',
  kesehatan_url='https://docs.google.com/document/d/1JxzgjizQALPjF6SlVD98rurBz5mxVWwA5vD7pUQVVf4/edit'
  WHERE id=1;

INSERT INTO payroll_periods (id, periode, status) VALUES (1,'2026-06','draft');

INSERT INTO payrolls (period_id, employee_id, gapok, tunj_pendidikan, tunj_jabatan, transport, bpjs_kesehatan_in, lain_lain, pot_thr, pot_bpjs_tk, deposit_itba, punishment, pinjaman, total_pendapatan, total_potongan, thp) VALUES
 (1,1, 3500000,750000,500000,300000,200000,200000, 0,120000,100000,0,0, 5450000,320000,5130000),
 (1,2, 3200000,600000,0,300000,180000,0, 0,110000,100000,0,250000, 4280000,460000,3820000),
 (1,3, 2800000,0,0,250000,150000,0, 0,100000,50000,0,0, 3200000,150000,3050000);

INSERT INTO documents (employee_id, jenis, judul, file_key) VALUES
 (1,'sk_aktivasi','SK Pengaktifan Resmi — Budi Santoso',NULL),
 (1,'spk','Surat Perjanjian Kerja (SPK) — Budi Santoso',NULL),
 (1,'cv','Curriculum Vitae — Budi Santoso',NULL),
 (NULL,'peraturan','Peraturan Kepegawaian AL WILDAN',NULL);

-- Sinkronkan sequence SERIAL setelah insert id eksplisit
SELECT setval(pg_get_serial_sequence('units','id'), (SELECT max(id) FROM units));
SELECT setval(pg_get_serial_sequence('employees','id'), (SELECT max(id) FROM employees));
SELECT setval(pg_get_serial_sequence('payroll_periods','id'), (SELECT max(id) FROM payroll_periods));
SELECT setval(pg_get_serial_sequence('payrolls','id'), (SELECT max(id) FROM payrolls));
SELECT setval(pg_get_serial_sequence('documents','id'), (SELECT max(id) FROM documents));
