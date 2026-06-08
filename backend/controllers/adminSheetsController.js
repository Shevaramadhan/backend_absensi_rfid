// controllers/adminSheetsController.js
const db = require('../config/database');
const { getSheetsClient } = require('../config/googleSheets');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// ============================================================
// HELPER: Nama sheet per bulan → "Juni 2026"
// ============================================================
const getNamaSheet = (bulan, tahun) => {
    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${namaBulan[bulan - 1]} ${tahun}`;
};

// ============================================================
// HELPER: Konversi menit → format "X jam Y menit"
// ============================================================
const formatDurasi = (menit) => {
    if (!menit || menit === 0) return '0 menit';
    const jam = Math.floor(menit / 60);
    const sisa = menit % 60;
    if (jam === 0) return `${sisa} menit`;
    if (sisa === 0) return `${jam} jam`;
    return `${jam} jam ${sisa} menit`;
};

// ============================================================
// HELPER: Pastikan sheet dengan nama tertentu ada di spreadsheet
//         Jika belum ada → buat sheet baru
// ============================================================
const pastikanSheetAda = async (sheets, namaSheet) => {
    // Ambil metadata spreadsheet untuk cek daftar sheet yang ada
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const daftarSheet = spreadsheet.data.sheets.map(s => s.properties.title);

    if (daftarSheet.includes(namaSheet)) {
        // Sheet sudah ada, cari sheetId-nya
        const sheetObj = spreadsheet.data.sheets.find(s => s.properties.title === namaSheet);
        return sheetObj.properties.sheetId;
    }

    // Sheet belum ada → buat baru
    const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
            requests: [{
                addSheet: {
                    properties: { title: namaSheet }
                }
            }]
        }
    });

    return response.data.replies[0].addSheet.properties.sheetId;
};

// ============================================================
// GET /api/admin/sheets/status — Cek koneksi ke Google Sheets
// ============================================================
const getStatusSheets = async (req, res) => {
    const sheets = getSheetsClient();

    if (!sheets) {
        return res.status(200).json({
            status: 'warning',
            aktif: false,
            message: 'Google Sheets belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_SHEET_ID di file .env'
        });
    }

    if (!SHEET_ID || SHEET_ID === 'your_spreadsheet_id_here') {
        return res.status(200).json({
            status: 'warning',
            aktif: false,
            message: 'GOOGLE_SHEET_ID belum diisi di .env'
        });
    }

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        res.status(200).json({
            status: 'success',
            aktif: true,
            message: 'Koneksi ke Google Sheets berhasil.',
            data: {
                judul_spreadsheet: spreadsheet.data.properties.title,
                jumlah_sheet: spreadsheet.data.sheets.length,
                daftar_sheet: spreadsheet.data.sheets.map(s => s.properties.title)
            }
        });
    } catch (error) {
        console.error('Error cek koneksi Sheets:', error.message);
        res.status(500).json({
            status: 'error',
            aktif: false,
            message: 'Gagal terhubung ke Google Sheets. Cek konfigurasi Service Account dan pastikan sudah di-share ke email service account.',
            detail: error.message
        });
    }
};

// ============================================================
// POST /api/admin/sheets/sync — Sync data absensi ke Spreadsheet
// Query param: ?bulan=6&tahun=2026 (default: bulan & tahun saat ini)
// ============================================================
const syncAbsensiKeSheets = async (req, res) => {
    const sheets = getSheetsClient();

    if (!sheets) {
        return res.status(503).json({
            status: 'error',
            message: 'Google Sheets belum dikonfigurasi. Isi variabel di .env terlebih dahulu.'
        });
    }

    if (!SHEET_ID || SHEET_ID === 'your_spreadsheet_id_here') {
        return res.status(503).json({
            status: 'error',
            message: 'GOOGLE_SHEET_ID belum diisi di .env'
        });
    }

    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const namaSheet = getNamaSheet(bulan, tahun);

    const connection = await db.getConnection();
    try {
        // 1. Ambil data rekap absensi dari MySQL
        const [rows] = await connection.query(`
            SELECT 
                u.nim,
                u.nama,
                a.tanggal,
                sh.nama_shift,
                sh.jam_mulai,
                sh.jam_selesai,
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
            return res.status(200).json({
                status: 'warning',
                message: `Tidak ada data absensi untuk ${namaSheet}.`,
                data: { jumlah_baris: 0 }
            });
        }

        // 2. Pastikan sheet bulan ini sudah ada (buat jika belum)
        await pastikanSheetAda(sheets, namaSheet);

        // 3. Clear dulu isi sheet lama
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `${namaSheet}!A1:Z10000`
        });

        // 4. Siapkan baris header
        const header = [
            ['NIM', 'Nama', 'Tanggal', 'Shift', 'Jam Mulai', 'Jam Selesai',
             'Waktu Masuk', 'Waktu Keluar', 'Durasi', 'Status']
        ];

        // 5. Siapkan baris data
        const dataRows = rows.map(r => [
            r.nim,
            r.nama,
            new Date(r.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            r.nama_shift,
            r.jam_mulai,
            r.jam_selesai,
            r.waktu_masuk,
            r.waktu_keluar,
            formatDurasi(r.durasi_menit),
            r.status
        ]);

        // 6. Tulis ke Google Sheets (header + data sekaligus)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${namaSheet}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [...header, ...dataRows]
            }
        });

        // 7. Format header (bold + background biru)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
                requests: [
                    // Bold & background header
                    {
                        repeatCell: {
                            range: {
                                sheetId: (await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID }))
                                    .data.sheets.find(s => s.properties.title === namaSheet)?.properties.sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.26, green: 0.52, blue: 0.96 },
                                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                                    horizontalAlignment: 'CENTER'
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                        }
                    }
                ]
            }
        });

        res.status(200).json({
            status: 'success',
            message: `Data absensi ${namaSheet} berhasil disinkronkan ke Google Spreadsheet.`,
            data: {
                sheet: namaSheet,
                jumlah_baris: rows.length,
                spreadsheet_id: SHEET_ID
            }
        });

    } catch (error) {
        console.error('Error Sync ke Sheets:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal sync ke Google Spreadsheet.',
            detail: error.message
        });
    } finally {
        connection.release();
    }
};

module.exports = { getStatusSheets, syncAbsensiKeSheets };
