const db = require('../config/database');
const bcrypt = require('bcrypt');
const { kirimEmail } = require('../config/mailer');

// ── POST /api/admin/anggota — Tambah Anggota Baru ──
const tambahAnggota = async (req, res) => {
    const { nama, sn, nim, email, id_rfid, jadwal_piket } = req.body;

    if (!nama || !nim || !sn || !email || !id_rfid || !jadwal_piket || !jadwal_piket.length) {
        return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi (termasuk jadwal).' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const defaultPassword = await bcrypt.hash(nim, 10);

        const [userResult] = await connection.query(
            'INSERT INTO users (nama, sn, nim, email, rfid_tag, role, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nama, sn, nim, email, id_rfid, 'Anggota', defaultPassword]
        );
        
        const userId = userResult.insertId;
        const scheduleValues = jadwal_piket.map(jadwal => [userId, jadwal.shift_id, jadwal.hari]); 
        
        await connection.query('INSERT INTO schedules (user_id, shift_id, hari_piket) VALUES ?', [scheduleValues]);
        await connection.commit();

        // Background Task: Kirim Notifikasi Email
        kirimEmailSelamatDatang(email, nama, nim);

        res.status(201).json({ status: 'success', message: 'Data anggota berhasil ditambahkan.' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'NIM atau ID RFID sudah terdaftar.' });
        }
        console.error('Error Tambah Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    } finally {
        connection.release();
    }
};

// ── GET /api/admin/anggota — Ambil Daftar Semua Anggota (Pagination & Search) ──
const getAnggota = async (req, res) => {
    const search = req.query.search || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;

    try {
        // Parallel queries untuk total & rows
        const [[[{ total }], [rows]]] = await Promise.all([
            db.query(`SELECT COUNT(DISTINCT u.id) AS total FROM users u WHERE u.role = 'Anggota' AND (u.nama LIKE ? OR u.nim LIKE ? OR u.rfid_tag LIKE ?)`, [searchParam, searchParam, searchParam]),
            db.query(`
                SELECT u.id, u.nama, u.sn, u.nim, u.email, u.rfid_tag, u.created_at,
                       GROUP_CONCAT(CONCAT(s.hari_piket, '|', sh.nama_shift, '|', s.shift_id) ORDER BY s.hari_piket SEPARATOR ';;') AS jadwal_raw
                FROM users u
                LEFT JOIN schedules s ON u.id = s.user_id
                LEFT JOIN shifts sh ON s.shift_id = sh.id
                WHERE u.role = 'Anggota' AND (u.nama LIKE ? OR u.nim LIKE ? OR u.rfid_tag LIKE ?)
                GROUP BY u.id ORDER BY u.nama ASC LIMIT ? OFFSET ?
            `, [searchParam, searchParam, searchParam, limit, offset])
        ]);

        const anggota = rows.map(u => ({
            ...u,
            jadwal_piket: u.jadwal_raw ? u.jadwal_raw.split(';;').map(j => {
                const [hari, nama_shift, shift_id] = j.split('|');
                return { hari, nama_shift, shift_id: parseInt(shift_id) };
            }) : []
        }));

        delete anggota.jadwal_raw; // Cleanup output

        res.status(200).json({
            status: 'success',
            data: anggota,
            pagination: { total, page, limit, total_pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Error Get Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data anggota.' });
    }
};

// ── GET /api/admin/anggota/:id — Ambil Detail 1 Anggota ──
const getAnggotaById = async (req, res) => {
    const userId = req.params.id;

    try {
        const [[user]] = await db.query('SELECT id, nama, sn, nim, email, rfid_tag, created_at FROM users WHERE id = ? AND role = "Anggota"', [userId]);
        if (!user) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan.' });

        const [jadwal] = await db.query(`
            SELECT s.id AS schedule_id, s.hari_piket AS hari, s.shift_id, sh.nama_shift, sh.jam_mulai, sh.jam_selesai
            FROM schedules s JOIN shifts sh ON s.shift_id = sh.id
            WHERE s.user_id = ? ORDER BY FIELD(s.hari_piket, 'Senin','Selasa','Rabu','Kamis','Jumat')`, 
            [userId]
        );

        res.status(200).json({ status: 'success', data: { ...user, jadwal_piket: jadwal } });
    } catch (error) {
        console.error('Error Get Anggota By ID:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat detail anggota.' });
    }
};

// ── PUT /api/admin/anggota/:id — Edit Data Anggota ──
const editAnggota = async (req, res) => {
    const userId = req.params.id;
    const { nama, sn, nim, email, id_rfid, jadwal_piket } = req.body;

    if (!nama || !nim || !sn || !email || !id_rfid) {
        return res.status(400).json({ status: 'error', message: 'Nama, SN, NIM, Email, dan RFID wajib diisi.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [cekDuplikat] = await connection.query('SELECT id FROM users WHERE (nim = ? OR email = ? OR rfid_tag = ?) AND id != ?', [nim, email, id_rfid, userId]);
        if (cekDuplikat.length > 0) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'NIM, Email, atau RFID sudah dipakai anggota lain.' });
        }

        await connection.query('UPDATE users SET nama = ?, sn = ?, nim = ?, email = ?, rfid_tag = ? WHERE id = ?', [nama, sn, nim, email, id_rfid, userId]);

        if (jadwal_piket && Array.isArray(jadwal_piket)) {
            await connection.query('DELETE FROM schedules WHERE user_id = ?', [userId]);
            if (jadwal_piket.length > 0) {
                const jadwalValues = jadwal_piket.map(jadwal => [userId, jadwal.shift_id, jadwal.hari]);
                await connection.query('INSERT INTO schedules (user_id, shift_id, hari_piket) VALUES ?', [jadwalValues]);
            }
        }

        await connection.commit();
        res.status(200).json({ status: 'success', message: 'Data profil dan jadwal anggota berhasil diperbarui.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error Edit Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memperbarui data anggota.' });
    } finally {
        connection.release();
    }
};

// ── DELETE /api/admin/anggota/:id — Hapus Anggota ──
const hapusAnggota = async (req, res) => {
    const userId = req.params.id;
    
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ? AND role = "Anggota"', [userId]);
        if (result.affectedRows === 0) return res.status(404).json({ status: 'error', message: 'Data anggota tidak ditemukan.' });

        res.status(200).json({ status: 'success', message: 'Data anggota beserta riwayatnya berhasil dihapus.' });
    } catch (error) {
        console.error('Error Hapus Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menghapus data anggota.' });
    }
};

// ── HELPER: Template Email Selamat Datang ──
const kirimEmailSelamatDatang = async (email, nama, nim) => {
    const subject = 'Akun Absensi Kamu Telah Dibuat — Neo Telemetri';
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
            <h2 style="color: #333;">Selamat Datang, ${nama}! 🎉</h2>
            <p>Akun absensi piket kamu telah berhasil dibuat oleh Admin.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                <p><strong>NIM:</strong> ${nim}</p>
                <p><strong>Password:</strong> ${nim} <em>(sama dengan NIM)</em></p>
            </div>
            <p style="color: #e74c3c;"><strong>⚠️ Segera ganti password setelah login!</strong></p>
        </div>`;
    
    try {
        await kirimEmail(email, subject, htmlBody);
    } catch (err) {
        console.warn('[EMAIL] Gagal kirim email ke anggota baru:', err.message);
    }
};

module.exports = { tambahAnggota, getAnggota, getAnggotaById, editAnggota, hapusAnggota };