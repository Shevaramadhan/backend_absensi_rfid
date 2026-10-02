const db = require('../config/database');
const { runPythonScript } = require('../utils/pythonRunner');
const path = require('path');
const fs = require('fs');

const ensureTableExists = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS member_courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            hari VARCHAR(20) NOT NULL,
            nama_matkul VARCHAR(255) NOT NULL,
            sks INT DEFAULT 0,
            jam_mulai VARCHAR(10) NOT NULL,
            jam_selesai VARCHAR(10) NOT NULL
        )
    `);
};

const getKrs = async (req, res) => {
    try {
        await ensureTableExists();
        const userId = req.user.id;
        const [rows] = await db.query('SELECT * FROM member_courses WHERE user_id = ?', [userId]);
        
        // Group by hari
        const krsData = {
            Senin: [], Selasa: [], Rabu: [], Kamis: [], Jumat: []
        };
        
        rows.forEach(row => {
            if (krsData[row.hari]) {
                krsData[row.hari].push({
                    id: row.id,
                    name: row.nama_matkul,
                    sks: row.sks,
                    start: row.jam_mulai,
                    end: row.jam_selesai
                });
            }
        });

        res.status(200).json({ status: 'success', data: krsData });
    } catch (error) {
        console.error('Error Get KRS:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat jadwal KRS.' });
    }
};

const saveKrs = async (req, res) => {
    const userId = req.user.id;
    const { krsData } = req.body;

    if (!krsData) {
        return res.status(400).json({ status: 'error', message: 'Data KRS kosong.' });
    }

    const connection = await db.getConnection();
    try {
        await ensureTableExists();
        await connection.beginTransaction();

        // Hapus krs lama untuk user ini
        await connection.query('DELETE FROM member_courses WHERE user_id = ?', [userId]);

        // Insert yang baru
        for (const [hari, courses] of Object.entries(krsData)) {
            for (const course of courses) {
                if (course.name && course.start && course.end) {
                    await connection.query(
                        'INSERT INTO member_courses (user_id, hari, nama_matkul, sks, jam_mulai, jam_selesai) VALUES (?, ?, ?, ?, ?, ?)',
                        [userId, hari, course.name, course.sks || 0, course.start, course.end]
                    );
                }
            }
        }

        await connection.commit();
        res.status(200).json({ status: 'success', message: 'Jadwal KRS berhasil disimpan.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error Save KRS:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menyimpan jadwal KRS.' });
    } finally {
        connection.release();
    }
};

const parsePdfKrs = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'File PDF tidak ditemukan.' });
    }

    try {
        const filePath = path.join(__dirname, '../', req.file.path);
        
        // Panggil script python
        const result = await runPythonScript('pdfParserController.py', [filePath]);

        if (result.status === 'success') {
            // Simpan nama file ke database agar admin bisa melihat bukti fisik KRS
            await db.query('UPDATE users SET file_krs = ? WHERE id = ?', [req.file.filename, req.user.id]);

            res.status(200).json({ status: 'success', data: result.data, message: result.message });
        } else {
            res.status(400).json({ status: 'error', message: result.message || 'Gagal ekstrak PDF.' });
        }

    } catch (error) {
        console.error('Error Parse PDF KRS:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memproses file PDF.' });
    }
};

module.exports = {
    getKrs,
    saveKrs,
    parsePdfKrs
};
