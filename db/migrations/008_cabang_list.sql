-- ============================================================
-- HR 3.0 — Migrasi 008: daftar cabang AL-WILDAN (sumber: list cabang + TIC)
-- Idempoten: ON CONFLICT (kode) DO NOTHING. Baris AW3 eksisting tidak ditimpa.
-- ============================================================

INSERT INTO cabangs (kode, nama) VALUES ('AW1', 'AL-WILDAN 1 GADING SERPONG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW2', 'AL-WILDAN 2 BEKASI') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW3', 'Al-Wildan 3 BSD City') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW4', 'AL-WILDAN 4 JAKARTA SELATAN') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW5', 'AL-WILDAN 5 JAKARTA PUSAT') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW7', 'AL-WILDAN 7 SERANG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW8', 'AL-WILDAN 8 KEMANG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW9', 'AL-WILDAN 9 DOMPU') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW10', 'AL-WILDAN 10 JAKARTA TIMUR') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW11', 'AL-WILDAN 11 JAKARTA PUSAT PEJOMPONGAN') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW12', 'AL-WILDAN 12 BEKASI') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW13', 'AL-WILDAN 13 BEKASI') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW14', 'AL-WILDAN 14 MUTIARA BOGOR') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW15', 'AL-WILDAN 15 BEKASI') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW16', 'AL-WILDAN 16 CILEDUG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW18', 'AL-WILDAN 18 BSD CITY') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW19', 'AL-WILDAN 19 JAKARTA BARAT') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW20', 'AL-WILDAN 20 MATARAM') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW21', 'AL-WILDAN 21 ACEH') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW22', 'AL-WILDAN 22 MAKASSAR') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW23', 'AL-WILDAN 23 SEMARANG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW24', 'AL-WILDAN 24 YOGYAKARTA') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW27', 'AL-WILDAN 27 ACEH BESAR') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW28', 'AL-WILDAN 28 GRAND WISATA') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW29', 'AL-WILDAN 29 DEPOK') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW30', 'AL-WILDAN 30 BEKASI') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW31', 'AL-WILDAN 31 CIBINONG') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('AW32', 'AL-WILDAN 32 JAKARTA TIMUR') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('LAIN', 'LAINNYA') ON CONFLICT (kode) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cabangs','id'), (SELECT max(id) FROM cabangs));
