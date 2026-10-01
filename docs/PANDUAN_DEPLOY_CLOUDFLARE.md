# Panduan Deploy HRIS AW3: Cloudflare + VPS Tencent (Lengkap)

> Dokumen hidup — diperbarui mengikuti langkah nyata yang sudah dilalui.
> Status: VPS aktif, DNS dalam propagasi, deploy aplikasi berikutnya.

## 0. Inventaris (isi nyata)

| Item | Nilai |
|---|---|
| Domain | `office-alwildan.id` (DomaiNesia) |
| Subdomain HRIS | `hr.office-alwildan.id` |
| Cloudflare plan | Free ($0) |
| Nameserver CF | `elias.ns.cloudflare.com`, `jasmine.ns.cloudflare.com` |
| VPS | Tencent Lighthouse 2C4G Singapore, Ubuntu24.04–Docker29 |
| IP publik VPS | `43.156.130.183` |
| Masa aktif VPS | s.d. 21 Sep 2027 |
| User SSH | `ubuntu` (login via console OrcaTerm / SSH) |

---

## BAGIAN A — Domain di Cloudflare ✅ SELESAI

- [x] Tambah `office-alwildan.id` ke Cloudflare, paket **Free** (cukup: DNS, SSL,
      proxy, 5 WAF rules, Bot Fight Mode).
- [x] Record A: `hr` → `43.156.130.183`, **Proxied ON**.
- [x] Nameserver di DomaiNesia → `elias` + `jasmine` (custom, NS 3–5 kosong).
- [x] DNSSEC OFF (form kosong = benar, jangan diisi).
- [ ] Cloudflare status **Active** (propagasi 1–24 jam; cek: `nslookup hr.office-alwildan.id`).
- [ ] SSL/TLS → **Full (strict)** + Always Use HTTPS (setelah Caddy hijau di VPS).

## BAGIAN B — Pembelian VPS ✅ SELESAI

- Produk: **Lighthouse Linux 2c 1yr, Starter 2vCPUs4G 30M70G** ($36/thn).
- Region **Singapore** (Jakarta tak tersedia untuk Lighthouse), Image
  **Ubuntu24.04–Docker29** (Docker preinstal), login password via webmail.

## BAGIAN C — Akses & penyiapan VPS (BERJALAN)

1. Console Tencent → Lighthouse → Instances → **Log in** (AUTO/`ubuntu`).
   - Bila "Password-free login is not available" (umum sesaat setelah reboot):
     tunggu 1–2 mnt dan ulangi; alternatif: protocol **SSH** + password webmail,
     atau **Log in via VNC**.
2. Verifikasi: `docker --version && docker compose version` (terkonfirmasi
   v29.6.1 + v5.3.1 ✅).
3. `sudo apt update && sudo apt upgrade -y`; reboot bila kernel baru
   (aman bila belum ada aplikasi jalan), login ulang.

## BAGIAN D — Transfer file & deploy (BERIKUTNYA)

1. Dari Terminal Mac:
   ```bash
   ssh ubuntu@43.156.130.183   # tes dulu; password dari webmail Tencent
   ```
2. Transfer folder (keluarkan yang berat **dan RAHASIA**):
   ```bash
   cd "/Users/kemal/Documents/KSP-AI/BLACK MIRROR"
   rsync -avz --exclude 'web/node_modules' --exclude 'api/node_modules' \
     --exclude 'web/dist' --exclude 'data' \
     --exclude '.env' --exclude 'api/.env' --exclude 'web/.env' \
     "HR 3.0/" ubuntu@43.156.130.183:~/hr30/
   ```
   > PENTING: `--exclude '.env'` wajib. `api/.env` laptop memuat `RESEND_API_KEY`
   > aktif — jangan sampai ikut ke VPS. `.env` produksi dibuat langsung di VPS.
3. Di VPS:
   ```bash
   cd ~/hr30
   cp .env.prod.example .env && chmod 600 .env
   nano .env   # isi AUTH_SECRET (openssl rand -base64 32) + DB_PASSWORD
   docker compose up -d --build
   sleep 25
   curl http://127.0.0.1:3000/api/health
   docker compose logs --tail 15 hr30   # "Migrasi HR 3.0 selesai"
   ```

## BAGIAN E — Caddy + go-live (SETELAH D AKTIF)

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
# isi:
# hr.office-alwildan.id {
#     encode gzip
#     reverse_proxy 127.0.0.1:3000 {
#         header_up X-Real-IP {remote_host}
#     }
# }
sudo systemctl reload caddy
```

Verifikasi: `https://hr.office-alwildan.id/login` gembok hijau → login admin demo
→ **amankan akun demo** → NIP final → 1 aktivasi + 1 slip → backup pertama →
cron harian (detail: `RUNBOOK_OPERASIONAL.md`).

> Header keamanan (CSP/HSTS/Permissions-Policy) sudah dikirim aplikasi
> (`api/src/index.js`), jadi tidak perlu diulang di Caddy. `header_up X-Real-IP`
> penting agar rate-limit login memakai IP asli, bukan IP Caddy.

## BAGIAN F — Hardening Cloudflare + VPS (SEBELUM publik)

**Cloudflare (dashboard, domain `office-alwildan.id`):**
- [ ] SSL/TLS → Overview → **Full (strict)** (Caddy sudah punya sertifikat).
- [ ] SSL/TLS → Edge Certificates → **Always Use HTTPS** ON, **HSTS** ON
      (max-age 6 bulan, includeSubDomains).
- [ ] Security → **Bot Fight Mode** ON.
- [ ] Security → WAF → Custom rules: block path mengandung
      `/.env`, `/.git`, `/wp-`, `/phpmyadmin`.
- [ ] Security → WAF → Rate limiting: `/api/login` → 20 req/menit per IP → Block 10 menit.
- [ ] Network → **DNSSEC OFF** (form kosong = benar, jangan diisi).

**VPS Tencent Lighthouse (`ubuntu@43.156.130.183`):**
```bash
# Firewall: hanya SSH + HTTP/HTTPS
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSH: kunci saja + fail2ban
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban

# Pastikan port 3000 TIDAK terbuka ke publik (sudah di-bind 127.0.0.1)
sudo ss -tlnp | grep 3000   # harus 127.0.0.1:3000, bukan 0.0.0.0:3000
```

- [ ] Verifikasi `curl -I https://hr.office-alwildan.id/login` menampilkan
      `strict-transport-security` dan `content-security-policy`.
- [ ] Ganti sandi akun demo/seed, lalu hapus akun non-produksi.
