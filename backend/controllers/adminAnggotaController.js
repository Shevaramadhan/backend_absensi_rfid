const db = require('../config/database');
const bcrypt = require('bcrypt');

// Fungsi Tambah Anggota
const tambahAnggota = async (req, res) => {
    const { nama, nim, id_rfid, jadwal_piket } = req.body;

    if (!nama || !nim || !id_rfid || !jadwal_piket || jadwal_piket.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Field nama, nim, id_rfid, dan jadwal wajib diisi.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const defaultPassword = await bcrypt.hash(nim, 10);

        const [userResult] = await connection.query(
            'INSERT INTO users (nama, nim, rfid_tag, role, password) VALUES (?, ?, ?, ?, ?)',
            [nama, nim, id_rfid, 'Anggota', defaultPassword]
        );
        
        const userId = userResult.insertId;
        const scheduleValues = jadwal_piket.map(jadwal => [userId, jadwal.shift_id, jadwal.hari]); 
        
        await connection.query(
            'INSERT INTO schedules (user_id, shift_id, hari_piket) VALUES ?',
            [scheduleValues]
        );

        await connection.commit();
        res.status(201).json({ status: 'success', message: 'Data anggota berhasil ditambahkan.' });

    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'NIM atau ID RFID sudah terdaftar.' });
        }
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    } finally {
        connection.release();
    }
};
// Fungsi Mengambil Daftar Semua Anggota
const getAnggota = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const [anggota] = await connection.query(
            'SELECT id, rfid_tag, nim, nama, created_at FROM users WHERE role = "Anggota" ORDER BY nama ASC'
        );
        res.status(200).json({ status: 'success', data: anggota });
    } catch (error) {
        console.error('Error Get Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data anggota.' });
    } finally {
        connection.release();
    }
};

// Fungsi Mengedit Data Anggota
const editAnggota = async (req, res) => {
    const userId = req.params.id;
    const { nama, nim, id_rfid, jadwal_piket } = req.body;

    if (!nama || !nim || !id_rfid) {
        return res.status(400).json({ status: 'error', message: 'Nama, NIM, dan RFID wajib diisi.' });
    }

    const connection = await db.getConnection();
    try {
        // 1. Mulai Transaksi Database (Mencegah data setengah masuk jika terjadi error)
        await connection.beginTransaction();

        // 2. Cek apakah NIM atau RFID sudah dipakai oleh anggota LAIN
        const [cekDuplikat] = await connection.query(
            'SELECT id FROM users WHERE (nim = ? OR rfid_tag = ?) AND id != ?',
            [nim, id_rfid, userId]
        );

        if (cekDuplikat.length > 0) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'NIM atau Kartu RFID sudah digunakan oleh anggota lain.' });
        }

        // 3. Update profil utama user
        await connection.query(
            'UPDATE users SET nama = ?, nim = ?, rfid_tag = ? WHERE id = ?',
            [nama, nim, id_rfid, userId]
        );

        // 4. Update relasi Jadwal Piket (Jika dikirim data jadwal_piket)
        if (jadwal_piket && Array.isArray(jadwal_piket)) {
            // Hapus semua jadwal lama milik user ini
            await connection.query('DELETE FROM schedules WHERE user_id = ?', [userId]);

            // Masukkan jadwal baru jika array tidak kosong
            if (jadwal_piket.length > 0) {
                // Format data array 2D untuk bulk insert MySQL
                const jadwalValues = jadwal_piket.map(jadwal => [userId, jadwal.shift_id, jadwal.hari]);
                
                await connection.query(
                    'INSERT INTO schedules (user_id, shift_id, hari_piket) VALUES ?',
                    [jadwalValues] // Perhatikan tanda kurung siku tambahan untuk bulk insert
                );
            }
        }

        // 5. Simpan semua perubahan secara permanen
        await connection.commit();
        res.status(200).json({ status: 'success', message: 'Data profil dan jadwal anggota berhasil diperbarui.' });

    } catch (error) {
        // Batalkan semua perubahan jika ada salah satu query yang gagal
        await connection.rollback();
        console.error('Error Edit Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memperbarui data anggota.' });
    } finally {
        connection.release();
    }
};

// Fungsi Menghapus Anggota
const hapusAnggota = async (req, res) => {
    const userId = req.params.id;
    const connection = await db.getConnection();
    
    try {
        const [result] = await connection.query('DELETE FROM users WHERE id = ? AND role = "Anggota"', [userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Data anggota tidak ditemukan.' });
        }

        res.status(200).json({ status: 'success', message: 'Data anggota beserta riwayatnya berhasil dihapus.' });
    } catch (error) {
        console.error('Error Hapus Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menghapus data anggota.' });
    } finally {
        connection.release();
    }
};

module.exports = {
    tambahAnggota,
    getAnggota,
    editAnggota,
    hapusAnggota
}; 