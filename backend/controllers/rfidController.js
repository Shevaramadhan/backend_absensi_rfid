const db = require('../config/database');
const { cekSistemAktif } = require('./systemController');

// ── POST /api/rfid/tap — Handler Utama Mesin RFID ──
const tapKartu = async (req, res) => {
    const { rfid_tag } = req.body;

    if (!rfid_tag) return res.status(400).json({ status: 'error', message: 'RFID Tag wajib dikirim.' });

    try {
        const sistem = await cekSistemAktif();
        if (!sistem.aktif) return res.status(503).json({ status: 'error', message: sistem.alasan });

        const [[user]] = await db.query('SELECT id, nama FROM users WHERE rfid_tag = ?', [rfid_tag]);
        if (!user) return res.status(404).json({ status: 'error', message: 'Kartu RFID tidak terdaftar.' });

        const [[absensiAktif]] = await db.query(
            `SELECT a.id, a.waktu_masuk, sh.jam_selesai 
             FROM attendances a
             JOIN shifts sh ON a.shift_id = sh.id
             WHERE a.user_id = ? AND a.tanggal = CURDATE() AND a.waktu_keluar IS NULL`,
            [user.id]
        );

        if (!absensiAktif) {
            return await handleTapMasuk(res, user);
        } else {
            return await handleTapKeluar(res, user, absensiAktif);
        }
    } catch (error) {
        console.error('Error RFID Tap:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    }
};

// ── HELPER: Logika Tap Masuk ──
const handleTapMasuk = async (res, user) => {
    const [[absensiSelesai]] = await db.query('SELECT id FROM attendances WHERE user_id = ? AND tanggal = CURDATE() AND status = "Hadir"', [user.id]);
    if (absensiSelesai) {
        return res.status(400).json({ status: 'error', message: `Halo ${user.nama}, kamu sudah piket hari ini.` });
    }

    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = namaHari[new Date().getDay()];

    let [jadwal] = await db.query(
        `SELECT s.shift_id, sh.jam_selesai FROM schedules s JOIN shifts sh ON s.shift_id = sh.id WHERE s.user_id = ? AND s.hari_piket = ?`,
        [user.id, hariIni]
    );

    if (jadwal.length === 0) {
        const [swapJadwal] = await db.query(
            `SELECT ss.shift_tujuan_id as shift_id, sh.jam_selesai FROM schedule_swaps ss JOIN shifts sh ON ss.shift_tujuan_id = sh.id
             WHERE ss.user_id = ? AND ss.tanggal_pengganti = CURDATE() AND ss.status = 'Belum Dilaksanakan'`,
            [user.id]
        );
        if (swapJadwal.length === 0) {
            return res.status(403).json({ status: 'error', message: `Maaf ${user.nama}, tidak ada jadwal piket hari ini.` });
        }
        jadwal = swapJadwal;
    }
    
    const jamSekarang = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
    const jamSelesaiShift = jadwal[0].jam_selesai;

    if (jamSekarang > jamSelesaiShift) {
        return res.status(400).json({ status: 'error', message: `Akses ditolak, ${user.nama}. Batas shift Anda (hingga ${jamSelesaiShift}) telah lewat. Silakan ajukan Ganti Jadwal.` });
    }

    await db.query('INSERT INTO attendances (user_id, shift_id, tanggal, status) VALUES (?, ?, CURDATE(), "Sedang Piket")', [user.id, jadwal[0].shift_id]);
    return res.status(200).json({ status: 'success', message: `Tap masuk berhasil. Selamat bertugas, ${user.nama}!` });
};

// ── HELPER: Logika Tap Keluar ──
const handleTapKeluar = async (res, user, absensiAktif) => {
    const waktuMasuk = new Date(absensiAktif.waktu_masuk);
    const waktuSekarang = new Date();
    const durasiRealMenit = Math.floor((waktuSekarang - waktuMasuk) / 60000);

    if (durasiRealMenit < 60) {
        return res.status(400).json({ status: 'error', message: `Tap ditolak. Durasi baru ${durasiRealMenit} menit. Minimal 60 menit.` });
    }

    const jamSelesaiStr = absensiAktif.jam_selesai;
    const [jam, mnt] = jamSelesaiStr.split(':').map(Number);
    const batasShift = new Date(waktuMasuk.getTime());
    batasShift.setHours(jam, mnt, 0, 0);

    const durasiMaxMenit = Math.floor((batasShift - waktuMasuk) / 60000);
    const durasiFinal = (durasiMaxMenit > 0 && durasiRealMenit > durasiMaxMenit) ? durasiMaxMenit : durasiRealMenit;
    const isCapped = durasiFinal < durasiRealMenit;

    await db.query('UPDATE attendances SET waktu_keluar = NOW(), durasi_menit = ?, status = "Hadir" WHERE id = ?', [durasiFinal, absensiAktif.id]);
    await db.query(`UPDATE schedule_swaps SET status = 'Selesai' WHERE user_id = ? AND tanggal_pengganti = CURDATE() AND status = 'Belum Dilaksanakan'`, [user.id]);

    const pesanDurasi = isCapped 
        ? ` Durasi dicatat ${durasiFinal} menit (dibatasi sampai akhir shift ${jamSelesaiStr}).`
        : ` Durasi piket: ${durasiFinal} menit.`;

    return res.status(200).json({ status: 'success', message: `Tap keluar berhasil. Terima kasih, ${user.nama}!${pesanDurasi}` });
};

module.exports = { tapKartu };