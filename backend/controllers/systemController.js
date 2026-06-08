const db = require('../config/database');

// ==========================================
// SYSTEM SETTINGS (Maintenance Mode)
// ==========================================

// GET: Cek status sistem
const getSystemStatus = async (req, res) => {
    try {
        const [settings] = await db.query('SELECT setting_key, setting_value FROM system_settings');
        const config = {};
        settings.forEach(s => { config[s.setting_key] = s.setting_value; });

        res.status(200).json({
            status: 'success',
            data: {
                maintenance_mode: config.maintenance_mode === 'true',
                maintenance_message: config.maintenance_message || ''
            }
        });
    } catch (error) {
        console.error('Error Get System Status:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat status sistem.' });
    }
};

// PUT: Toggle maintenance mode ON/OFF
const toggleMaintenance = async (req, res) => {
    const { aktif, pesan } = req.body;

    if (typeof aktif !== 'boolean') {
        return res.status(400).json({ status: 'error', message: 'Field aktif (boolean) wajib diisi.' });
    }

    try {
        await db.query(
            "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_mode'",
            [aktif.toString()]
        );

        if (pesan) {
            await db.query(
                "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_message'",
                [pesan]
            );
        }

        res.status(200).json({
            status: 'success',
            message: aktif ? 'Sistem dimatikan (maintenance mode ON).' : 'Sistem diaktifkan kembali.'
        });
    } catch (error) {
        console.error('Error Toggle Maintenance:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengubah status sistem.' });
    }
};

// ==========================================
// HOLIDAYS (Hari Libur Terjadwal)
// ==========================================

// GET: Daftar hari libur
const getHolidays = async (req, res) => {
    try {
        const [holidays] = await db.query(
            'SELECT id, tanggal, keterangan, created_at FROM holidays ORDER BY tanggal ASC'
        );
        res.status(200).json({ status: 'success', data: holidays });
    } catch (error) {
        console.error('Error Get Holidays:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data hari libur.' });
    }
};

// POST: Tambah hari libur
const tambahHoliday = async (req, res) => {
    const { tanggal, keterangan } = req.body;
    const adminId = req.user.id;

    if (!tanggal || !keterangan) {
        return res.status(400).json({ status: 'error', message: 'Tanggal dan keterangan wajib diisi.' });
    }

    try {
        await db.query(
            'INSERT INTO holidays (tanggal, keterangan, created_by) VALUES (?, ?, ?)',
            [tanggal, keterangan, adminId]
        );
        res.status(201).json({ status: 'success', message: `Hari libur ${tanggal} berhasil ditambahkan.` });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'Tanggal tersebut sudah terdaftar sebagai hari libur.' });
        }
        console.error('Error Tambah Holiday:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menambah hari libur.' });
    }
};

// DELETE: Hapus hari libur
const hapusHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM holidays WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Hari libur tidak ditemukan.' });
        }
        res.status(200).json({ status: 'success', message: 'Hari libur berhasil dihapus.' });
    } catch (error) {
        console.error('Error Hapus Holiday:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menghapus hari libur.' });
    }
};

// ==========================================
// HELPER: Cek apakah hari ini libur/maintenance
// (Digunakan oleh rfidController & cron)
// ==========================================
const cekSistemAktif = async () => {
    try {
        // Cek maintenance mode
        const [settings] = await db.query(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode'"
        );
        if (settings.length > 0 && settings[0].setting_value === 'true') {
            const [msg] = await db.query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_message'"
            );
            return { aktif: false, alasan: msg[0]?.setting_value || 'Sistem sedang maintenance.' };
        }

        // Cek hari libur
        const [holiday] = await db.query(
            'SELECT keterangan FROM holidays WHERE tanggal = CURDATE()'
        );
        if (holiday.length > 0) {
            return { aktif: false, alasan: `Hari ini libur: ${holiday[0].keterangan}` };
        }

        return { aktif: true, alasan: null };
    } catch (error) {
        console.error('Error Cek Sistem:', error);
        return { aktif: true, alasan: null }; // Default: biarkan berjalan jika error
    }
};

module.exports = {
    getSystemStatus,
    toggleMaintenance,
    getHolidays,
    tambahHoliday,
    hapusHoliday,
    cekSistemAktif
};
