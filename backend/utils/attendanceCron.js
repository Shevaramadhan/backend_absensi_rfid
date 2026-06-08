// utils/attendanceCron.js
const cron = require('node-cron');
const db = require('../config/database');
const { kirimEmail } = require('../config/mailer');
const { cekSistemAktif } = require('../controllers/systemController');
const { getSheetsClient } = require('../config/googleSheets');

const jalankanCronAbsensi = () => {
    const cronOptions = { timezone: "Asia/Jakarta" };

    // 1. Pengecekan Absensi (Jam 18:00)
    // Jadwal berjalan: Menit ke-0, Jam ke-18, Setiap hari Senin(1) - Jumat(5)
    cron.schedule('0 18 * * 1-5', async () => {
        console.log('[CRON] Menjalankan pengecekan absensi otomatis pada 18:00...');

        // Cek apakah sistem aktif (skip jika maintenance/libur)
        const sistem = await cekSistemAktif();
        if (!sistem.aktif) {
            console.log(`[CRON] Dilewati: ${sistem.alasan}`);
            return;
        }

        const connection = await db.getConnection();

        try {
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
            const hariIni = namaHari[now.getDay()];

            await connection.beginTransaction();

            // 1. Ambil daftar anggota yang bolos (belum tap sama sekali) sebelum insert
            //    DITAMBAH: Kecualikan mereka yang memiliki form Ganti Jadwal (Swap Shield)
            const [anggotaBolos] = await connection.query(`
                SELECT u.id, u.nama, u.email
                FROM schedules s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE()
                LEFT JOIN schedule_swaps ss ON s.user_id = ss.user_id AND ss.tanggal_absen_asli = CURDATE() AND ss.status IN ('Belum Dilaksanakan', 'Selesai')
                WHERE s.hari_piket = ? AND a.id IS NULL AND ss.id IS NULL
            `, [hariIni]);

            // 2. Tandai "Tidak Hadir" untuk yang sama sekali belum tap hari ini (dan tidak dilindungi swap)
            const [insertBolos] = await connection.query(`
                INSERT INTO attendances (user_id, shift_id, tanggal, status)
                SELECT s.user_id, s.shift_id, CURDATE(), 'Tidak Hadir'
                FROM schedules s
                LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE()
                LEFT JOIN schedule_swaps ss ON s.user_id = ss.user_id AND ss.tanggal_absen_asli = CURDATE() AND ss.status IN ('Belum Dilaksanakan', 'Selesai')
                WHERE s.hari_piket = ? AND a.id IS NULL AND ss.id IS NULL
            `, [hariIni]);

            // 3. Ambil anggota yang lupa tap keluar (TANPA FOTO BUKTI) sebelum update untuk dikirimi email
            const [anggotaLupaKeluar] = await connection.query(`
                SELECT u.nama, u.email
                FROM attendances a
                JOIN users u ON a.user_id = u.id
                WHERE a.tanggal = CURDATE() AND a.status = 'Sedang Piket' AND a.bukti_foto IS NULL AND u.email IS NOT NULL
            `);

            // 4a. GOLONGAN TOLERANSI: Lupa tap keluar TAPI ADA foto bukti
            // Anggap pulang sesuai jam selesai shift-nya
            const [updateLupaKeluarToleransi] = await connection.query(`
                UPDATE attendances a
                JOIN shifts sh ON a.shift_id = sh.id
                SET a.status = 'Hadir',
                    a.waktu_keluar = STR_TO_DATE(CONCAT(a.tanggal, ' ', sh.jam_selesai), '%Y-%m-%d %H:%i:%s'),
                    a.durasi_menit = GREATEST(0, TIMESTAMPDIFF(MINUTE, a.waktu_masuk, STR_TO_DATE(CONCAT(a.tanggal, ' ', sh.jam_selesai), '%Y-%m-%d %H:%i:%s')))
                WHERE a.tanggal = CURDATE() AND a.status = 'Sedang Piket' AND a.bukti_foto IS NOT NULL
            `);

            // 4b. GOLONGAN ALPA: Lupa tap keluar dan TIDAK ADA foto bukti
            const [updateLupaKeluarAlpa] = await connection.query(`
                UPDATE attendances 
                SET status = 'Tidak Hadir', durasi_menit = 0, waktu_keluar = NOW()
                WHERE tanggal = CURDATE() AND status = 'Sedang Piket' AND bukti_foto IS NULL
            `);

            // =========================================================
            // 5. EKSEKUSI HANGUS (Strict Swap Rules)
            // =========================================================
            // Cari janji swap yang jatuh tempo hari ini (CURDATE = tanggal_pengganti)
            // tapi statusnya masih 'Belum Dilaksanakan' (artinya dia bolos janji gantinya!)
            const [swapHangus] = await connection.query(`
                SELECT user_id, shift_awal_id, tanggal_absen_asli 
                FROM schedule_swaps 
                WHERE tanggal_pengganti = CURDATE() AND status = 'Belum Dilaksanakan'
            `);

            if (swapHangus.length > 0) {
                // 5a. Tandai swap menjadi Hangus
                await connection.query(`
                    UPDATE schedule_swaps 
                    SET status = 'Hangus' 
                    WHERE tanggal_pengganti = CURDATE() AND status = 'Belum Dilaksanakan'
                `);

                // 5b. Masukkan nilai "Tidak Hadir" ke tanggal aslinya
                // Karena ini batch, kita siapkan array values
                const valuesHangus = swapHangus.map(s => [s.user_id, s.shift_awal_id, s.tanggal_absen_asli, 'Tidak Hadir']);
                await connection.query(`
                    INSERT INTO attendances (user_id, shift_id, tanggal, status) 
                    VALUES ?
                    ON DUPLICATE KEY UPDATE status = 'Tidak Hadir'
                `, [valuesHangus]);
                
                console.log(`[CRON] ${swapHangus.length} janji Ganti Jadwal HANGUS dan dihukum Alpa.`);
            }

            await connection.commit();
            console.log(`[CRON] Sukses. Bolos: ${insertBolos.affectedRows}. Lupa Keluar (Alpa): ${updateLupaKeluarAlpa.affectedRows}. Lupa Keluar (Ditoleransi): ${updateLupaKeluarToleransi.affectedRows}.`);

            // 5. Kirim email peringatan ke anggota yang tidak hadir (async)
            const semuaTidakHadir = [...anggotaBolos, ...anggotaLupaKeluar];
            for (const anggota of semuaTidakHadir) {
                if (anggota.email) {
                    kirimEmail(
                        anggota.email,
                        `Peringatan: Kamu Tidak Hadir Piket Hari Ini`,
                        `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #e74c3c;">⚠️ Peringatan Ketidakhadiran</h2>
                            <p>Halo <strong>${anggota.nama}</strong>,</p>
                            <p>Kamu tercatat <strong>Tidak Hadir</strong> pada piket hari ini (<strong>${hariIni}</strong>).</p>
                            <p>Jika kamu memiliki alasan, silakan ajukan <strong>Pengajuan Izin</strong> melalui aplikasi.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">Absensi Neo Telemetri — Sistem Absensi RFID</p>
                        </div>
                        `
                    ).catch(err => console.warn(`[EMAIL] Gagal kirim peringatan ke ${anggota.nama}:`, err.message));
                }
            }

        } catch (error) {
            await connection.rollback();
            console.error('[CRON] Terjadi kesalahan saat update absensi:', error);
        } finally {
            connection.release();
        }
    }, cronOptions);

    // 2. Pengingat Jadwal Piket (Jam 07:00 Pagi)
    cron.schedule('0 7 * * 1-5', async () => {
        console.log('[CRON] Menjalankan pengingat piket pagi pada 07:00...');
        const connection = await db.getConnection();
        try {
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
            const hariIni = namaHari[now.getDay()];

            const [jadwalPagi] = await connection.query(`
                SELECT u.nama, u.email, sh.nama_shift, sh.jam_mulai, sh.jam_selesai
                FROM schedules s
                JOIN users u ON s.user_id = u.id
                JOIN shifts sh ON s.shift_id = sh.id
                WHERE s.hari_piket = ? AND u.email IS NOT NULL
            `, [hariIni]);

            for (const jadwal of jadwalPagi) {
                kirimEmail(
                    jadwal.email,
                    `Pengingat: Jadwal Piket Kamu Hari Ini`,
                    `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2980b9;">📅 Pengingat Piket Hari Ini</h2>
                        <p>Halo <strong>${jadwal.nama}</strong>,</p>
                        <p>Jangan lupa, kamu memiliki jadwal piket hari ini (<strong>${hariIni}</strong>).</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Shift:</strong> ${jadwal.nama_shift}</p>
                            <p style="margin: 5px 0;"><strong>Jam:</strong> ${jadwal.jam_mulai} - ${jadwal.jam_selesai}</p>
                        </div>
                        <p>Pastikan kamu tap masuk sebelum shift berakhir ya! Selamat bertugas!</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px;">Absensi Neo Telemetri — Sistem Absensi RFID</p>
                    </div>
                    `
                ).catch(err => console.warn(`[EMAIL] Gagal kirim pengingat pagi ke ${jadwal.nama}:`, err.message));
            }
        } catch (error) {
            console.error('[CRON] Terjadi kesalahan saat pengingat pagi:', error);
        } finally {
            connection.release();
        }
    }, cronOptions);

    // 3. Pengingat 30 Menit Sebelum Shift Dimulai (Setiap Menit)
    cron.schedule('* * * * 1-5', async () => {
        const connection = await db.getConnection();
        try {
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
            const hariIni = namaHari[now.getDay()];

            // Tambah 30 menit ke waktu sekarang
            now.setMinutes(now.getMinutes() + 30);
            const targetJam = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            const [jadwalMendekati] = await connection.query(`
                SELECT u.nama, u.email, sh.nama_shift, sh.jam_mulai, sh.jam_selesai
                FROM schedules s
                JOIN users u ON s.user_id = u.id
                JOIN shifts sh ON s.shift_id = sh.id
                WHERE s.hari_piket = ? AND u.email IS NOT NULL AND TIME_FORMAT(sh.jam_mulai, '%H:%i') = ?
            `, [hariIni, targetJam]);

            for (const jadwal of jadwalMendekati) {
                kirimEmail(
                    jadwal.email,
                    `Persiapan: Shift Kamu Mulai 30 Menit Lagi`,
                    `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f39c12;">⏳ Shift Segera Dimulai</h2>
                        <p>Halo <strong>${jadwal.nama}</strong>,</p>
                        <p>Mengingatkan bahwa jadwal piket kamu akan dimulai dalam <strong>30 menit</strong> lagi.</p>
                        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Shift:</strong> ${jadwal.nama_shift}</p>
                            <p style="margin: 5px 0;"><strong>Jam:</strong> ${jadwal.jam_mulai} - ${jadwal.jam_selesai}</p>
                        </div>
                        <p>Segera bersiap dan jangan lupa tap kehadiranmu di sekre.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px;">Absensi Neo Telemetri — Sistem Absensi RFID</p>
                    </div>
                    `
                ).catch(err => console.warn(`[EMAIL] Gagal kirim pengingat 30mnt ke ${jadwal.nama}:`, err.message));
            }
        } catch (error) {
            console.error('[CRON] Terjadi kesalahan saat pengingat 30 menit:', error);
        } finally {
            connection.release();
        }
    }, cronOptions);

    // ============================================================
    // 4. Sync Otomatis ke Google Spreadsheet (Setiap Senin 08:00)
    //    Menyinkronkan rekap absensi bulan LALU ke Spreadsheet
    // ============================================================
    cron.schedule('0 8 * * 1', async () => {
        console.log('[CRON] Menjalankan sync otomatis ke Google Spreadsheet...');
        const sheets = getSheetsClient();

        if (!sheets) {
            console.log('[CRON] Google Sheets tidak dikonfigurasi, sync dilewati.');
            return;
        }

        const SHEET_ID = process.env.GOOGLE_SHEET_ID;
        if (!SHEET_ID || SHEET_ID === 'your_spreadsheet_id_here') {
            console.log('[CRON] GOOGLE_SHEET_ID belum diisi, sync dilewati.');
            return;
        }

        // Tentukan bulan & tahun yang akan di-sync (bulan berjalan)
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const bulan = now.getMonth() + 1;
        const tahun = now.getFullYear();

        const namaBulan = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const namaSheet = `${namaBulan[bulan - 1]} ${tahun}`;

        const connection = await db.getConnection();
        try {
            const [rows] = await connection.query(`
                SELECT 
                    u.nim, u.nama, a.tanggal,
                    sh.nama_shift, sh.jam_mulai, sh.jam_selesai,
                    IFNULL(TIME_FORMAT(a.waktu_masuk, '%H:%i'), '-') AS waktu_masuk,
                    IFNULL(TIME_FORMAT(a.waktu_keluar, '%H:%i'), '-') AS waktu_keluar,
                    IFNULL(a.durasi_menit, 0) AS durasi_menit,
                    a.status
                FROM attendances a
                JOIN users u ON a.user_id = u.id
                JOIN shifts sh ON a.shift_id = sh.id
                WHERE MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
                ORDER BY a.tanggal ASC, u.nama ASC
            `, [bulan, tahun]);

            if (rows.length === 0) {
                console.log(`[CRON] Tidak ada data absensi untuk ${namaSheet}, sync dilewati.`);
                return;
            }

            // Cek atau buat sheet bulan ini
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
            const daftarSheet = spreadsheet.data.sheets.map(s => s.properties.title);

            if (!daftarSheet.includes(namaSheet)) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SHEET_ID,
                    requestBody: { requests: [{ addSheet: { properties: { title: namaSheet } } }] }
                });
            }

            // Clear & tulis ulang data
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SHEET_ID,
                range: `${namaSheet}!A1:Z10000`
            });

            const formatDurasi = (menit) => {
                if (!menit || menit === 0) return '0 menit';
                const jam = Math.floor(menit / 60);
                const sisa = menit % 60;
                if (jam === 0) return `${sisa} menit`;
                if (sisa === 0) return `${jam} jam`;
                return `${jam} jam ${sisa} menit`;
            };

            const header = [['NIM', 'Nama', 'Tanggal', 'Shift', 'Jam Mulai', 'Jam Selesai', 'Waktu Masuk', 'Waktu Keluar', 'Durasi', 'Status']];
            const dataRows = rows.map(r => [
                r.nim, r.nama,
                new Date(r.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                r.nama_shift, r.jam_mulai, r.jam_selesai,
                r.waktu_masuk, r.waktu_keluar,
                formatDurasi(r.durasi_menit), r.status
            ]);

            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: `${namaSheet}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [...header, ...dataRows] }
            });

            console.log(`[CRON] ✅ Sync ke Spreadsheet selesai: ${rows.length} baris → sheet "${namaSheet}"`);

        } catch (error) {
            console.error('[CRON] ❌ Gagal sync ke Google Spreadsheet:', error.message);
        } finally {
            connection.release();
        }
    }, cronOptions);
};

module.exports = jalankanCronAbsensi;