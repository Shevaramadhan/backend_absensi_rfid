// controllers/exportController.js
// Endpoint: GET /api/admin/laporan/export?format=pdf|excel&dari_tanggal=...&sampai_tanggal=...
//           GET /api/anggota/laporan/export?format=pdf|excel&bulan=...&tahun=...
const db     = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ============================================================
// HELPER: Format durasi menit → "X jam Y menit"
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
// HELPER: Format tanggal objek ke "dd/mm/yyyy Hari"
// ============================================================
const formatTanggal = (tanggal) => {
    if (!tanggal) return '-';
    const d = new Date(tanggal);
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return `${namaHari[d.getDay()]} / ${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};

const formatJam = (waktu) => {
    if (!waktu) return '-';
    // waktu bisa berupa Date object atau string "HH:MM:SS"
    if (waktu instanceof Date) {
        return waktu.toTimeString().slice(0, 5);
    }
    return String(waktu).slice(0, 5);
};

// ============================================================
// HELPER: Ambil data dari DB berdasarkan filter
// ============================================================
const queryLaporanAdmin = async (queryParams) => {
    const { dari_tanggal, sampai_tanggal, bulan, tahun } = queryParams;

    let whereClause, params, labelPeriode;

    if (dari_tanggal && sampai_tanggal) {
        whereClause = 'WHERE a.tanggal BETWEEN ? AND ?';
        params = [dari_tanggal, sampai_tanggal];
        labelPeriode = `${dari_tanggal} s/d ${sampai_tanggal}`;
    } else {
        const b = bulan || new Date().getMonth() + 1;
        const t = tahun || new Date().getFullYear();
        whereClause = 'WHERE MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
        params = [b, t];
        labelPeriode = `Bulan ${b} Tahun ${t}`;
    }

    const [rows] = await db.query(
        `SELECT u.nama, u.nim, a.tanggal, sh.nama_shift,
                a.waktu_masuk, a.waktu_keluar, a.durasi_menit, a.status, a.bukti_foto
         FROM attendances a
         JOIN users u ON a.user_id = u.id
         JOIN shifts sh ON a.shift_id = sh.id
         ${whereClause}
         ORDER BY a.tanggal DESC, a.waktu_masuk ASC`,
        params
    );

    return { rows, labelPeriode };
};

const queryLaporanAnggota = async (userId, queryParams) => {
    const bulan = queryParams.bulan || new Date().getMonth() + 1;
    const tahun = queryParams.tahun || new Date().getFullYear();
    const labelPeriode = `Bulan ${bulan} Tahun ${tahun}`;

    const [rows] = await db.query(
        `SELECT a.tanggal, sh.nama_shift, sh.jam_mulai, sh.jam_selesai,
                a.waktu_masuk, a.waktu_keluar, a.durasi_menit, a.status
         FROM attendances a
         JOIN shifts sh ON a.shift_id = sh.id
         WHERE a.user_id = ? AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
         ORDER BY a.tanggal DESC`,
        [userId, bulan, tahun]
    );

    return { rows, labelPeriode };
};

// ============================================================
// EXCEL EXPORT — Admin Laporan
// ============================================================
const exportLaporanAdminExcel = async (req, res) => {
    try {
        const { rows, labelPeriode } = await queryLaporanAdmin(req.query);

        const workbook  = new ExcelJS.Workbook();
        workbook.creator = 'Sistem Absensi Neo Telemetri';
        const sheet = workbook.addWorksheet(`Laporan ${labelPeriode}`);

        // Definisi kolom
        sheet.columns = [
            { header: 'No',           key: 'no',        width: 6  },
            { header: 'Nama',         key: 'nama',       width: 22 },
            { header: 'NIM',          key: 'nim',        width: 14 },
            { header: 'Hari / Tanggal', key: 'tanggal', width: 22 },
            { header: 'Shift',        key: 'shift',      width: 16 },
            { header: 'Jam Datang',   key: 'masuk',      width: 13 },
            { header: 'Jam Pulang',   key: 'keluar',     width: 13 },
            { header: 'Durasi',       key: 'durasi',     width: 16 },
            { header: 'Status',       key: 'status',     width: 14 },
        ];

        // Judul di baris 1
        sheet.spliceRows(1, 0, []);  // sisipkan baris kosong
        sheet.spliceRows(1, 0, []);
        sheet.getRow(1).getCell(1).value = 'Laporan Absensi RFID — NEO TELEMETRI';
        sheet.getRow(2).getCell(1).value = `Periode: ${labelPeriode}`;
        sheet.mergeCells('A1:I1');
        sheet.mergeCells('A2:I2');

        // Style judul
        ['A1', 'A2'].forEach(cell => {
            sheet.getCell(cell).font = { bold: true, size: cell === 'A1' ? 14 : 11 };
            sheet.getCell(cell).alignment = { horizontal: 'center' };
        });
        sheet.getRow(1).height = 24;

        // Header row (row 3 setelah splice)
        const headerRow = sheet.getRow(3);
        headerRow.eachCell(cell => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
            cell.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });
        headerRow.height = 18;

        // Data rows
        rows.forEach((r, i) => {
            const row = sheet.addRow({
                no:      i + 1,
                nama:    r.nama,
                nim:     r.nim,
                tanggal: formatTanggal(r.tanggal),
                shift:   r.nama_shift,
                masuk:   formatJam(r.waktu_masuk),
                keluar:  formatJam(r.waktu_keluar),
                durasi:  formatDurasi(r.durasi_menit),
                status:  r.status,
            });

            // Warna status
            const statusCell = row.getCell('status');
            if (r.status === 'Hadir')        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            else if (r.status === 'Izin')    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            else if (r.status === 'Tidak Hadir') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

            // Warna baris selang-seling
            if (i % 2 === 0) {
                row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    if (colNum !== 9) { // jangan timpa warna status
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                });
            }

            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                };
            });
        });

        // Freeze header
        sheet.views = [{ state: 'frozen', ySplit: 3 }];

        // Kirim file
        const fileName = `Laporan_Absensi_${labelPeriode.replace(/\s/g, '_').replace(/\//g, '-')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error Export Excel Admin:', error);
        res.status(500).json({ status: 'error', message: 'Gagal export Excel.' });
    }
};

// ============================================================
// PDF EXPORT — Admin Laporan
// ============================================================
const exportLaporanAdminPdf = async (req, res) => {
    try {
        const { rows, labelPeriode } = await queryLaporanAdmin(req.query);

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const fileName = `Laporan_Absensi_${labelPeriode.replace(/\s/g, '_').replace(/\//g, '-')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        doc.pipe(res);

        // Judul
        doc.fontSize(16).font('Helvetica-Bold')
           .text('Laporan Absensi RFID — NEO TELEMETRI', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
           .text(`Periode: ${labelPeriode}`, { align: 'center' });
        doc.moveDown(0.8);

        // Definisi kolom tabel
        const cols = [
            { label: 'No',            width: 28,  key: (r, i) => i + 1 },
            { label: 'Nama',          width: 110, key: r => r.nama },
            { label: 'NIM',           width: 80,  key: r => r.nim },
            { label: 'Hari/Tanggal',  width: 100, key: r => formatTanggal(r.tanggal) },
            { label: 'Shift',         width: 70,  key: r => r.nama_shift },
            { label: 'Datang',        width: 50,  key: r => formatJam(r.waktu_masuk) },
            { label: 'Pulang',        width: 50,  key: r => formatJam(r.waktu_keluar) },
            { label: 'Durasi',        width: 70,  key: r => formatDurasi(r.durasi_menit) },
            { label: 'Status',        width: 60,  key: r => r.status },
        ];

        const rowHeight = 18;
        const headerH  = 22;
        let   y = doc.y;
        const startX = doc.page.margins.left;

        // Gambar header tabel
        const drawHeader = (yPos) => {
            let x = startX;
            doc.rect(startX, yPos, cols.reduce((s, c) => s + c.width, 0), headerH)
               .fill('#D97706');

            cols.forEach(col => {
                doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
                   .text(col.label, x + 3, yPos + 6, { width: col.width - 6, align: 'center' });
                x += col.width;
            });

            // Garis header
            x = startX;
            cols.forEach(col => {
                doc.strokeColor('#B45309').lineWidth(0.5)
                   .rect(x, yPos, col.width, headerH).stroke();
                x += col.width;
            });

            return yPos + headerH;
        };

        y = drawHeader(y);

        // Gambar data rows
        rows.forEach((r, i) => {
            // Cek apakah perlu halaman baru
            if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                y = doc.page.margins.top;
                y = drawHeader(y);
            }

            const bgColor = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
            let x = startX;
            const totalWidth = cols.reduce((s, c) => s + c.width, 0);
            doc.rect(startX, y, totalWidth, rowHeight).fill(bgColor);

            cols.forEach((col, ci) => {
                // Warna teks status
                let textColor = '#111827';
                if (ci === 8) { // kolom status
                    if (r.status === 'Hadir') textColor = '#065F46';
                    else if (r.status === 'Tidak Hadir') textColor = '#991B1B';
                    else if (r.status === 'Izin') textColor = '#92400E';
                }

                const val = String(typeof col.key === 'function' ? col.key(r, i) : '');
                doc.fillColor(textColor).fontSize(7.5).font('Helvetica')
                   .text(val, x + 3, y + 5, { width: col.width - 6, align: 'left', lineBreak: false });

                doc.strokeColor('#E5E7EB').lineWidth(0.3)
                   .rect(x, y, col.width, rowHeight).stroke();
                x += col.width;
            });

            y += rowHeight;
        });

        // Footer
        doc.moveDown(1);
        doc.fontSize(8).fillColor('#6B7280').font('Helvetica')
           .text(`Total: ${rows.length} data  |  Diekspor: ${new Date().toLocaleString('id-ID')}`, { align: 'right' });

        doc.end();
    } catch (error) {
        console.error('Error Export PDF Admin:', error);
        res.status(500).json({ status: 'error', message: 'Gagal export PDF.' });
    }
};

// ============================================================
// EXCEL EXPORT — Anggota (rekap pribadi)
// ============================================================
const exportLaporanAnggotaExcel = async (req, res) => {
    try {
        const userId = req.user.id;
        const namaUser = req.user.nama;
        const { rows, labelPeriode } = await queryLaporanAnggota(userId, req.query);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistem Absensi Neo Telemetri';
        const sheet = workbook.addWorksheet(`Rekap ${labelPeriode}`);

        sheet.columns = [
            { header: 'No',         key: 'no',      width: 6  },
            { header: 'Hari',       key: 'hari',    width: 12 },
            { header: 'Tanggal',    key: 'tanggal', width: 16 },
            { header: 'Shift',      key: 'shift',   width: 18 },
            { header: 'Mulai',      key: 'mulai',   width: 12 },
            { header: 'Selesai',    key: 'selesai', width: 12 },
            { header: 'Durasi',     key: 'durasi',  width: 16 },
            { header: 'Status',     key: 'status',  width: 14 },
        ];

        // Judul
        sheet.spliceRows(1, 0, []);
        sheet.spliceRows(1, 0, []);
        sheet.getRow(1).getCell(1).value = `Rekap Kehadiran — ${namaUser}`;
        sheet.getRow(2).getCell(1).value = `Periode: ${labelPeriode}`;
        sheet.mergeCells('A1:H1');
        sheet.mergeCells('A2:H2');
        ['A1', 'A2'].forEach(c => {
            sheet.getCell(c).font = { bold: true, size: c === 'A1' ? 13 : 10 };
            sheet.getCell(c).alignment = { horizontal: 'center' };
        });

        // Header
        const headerRow = sheet.getRow(3);
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: {style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
        });

        // Data
        const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        rows.forEach((r, i) => {
            const d = new Date(r.tanggal);
            const row = sheet.addRow({
                no:      i + 1,
                hari:    namaHari[d.getDay()],
                tanggal: d.toLocaleDateString('id-ID'),
                shift:   r.nama_shift,
                mulai:   formatJam(r.waktu_masuk),
                selesai: formatJam(r.waktu_keluar),
                durasi:  formatDurasi(r.durasi_menit),
                status:  r.status,
            });

            const statusCell = row.getCell('status');
            if (r.status === 'Hadir')        statusCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD1FAE5'} };
            else if (r.status === 'Izin')    statusCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFEF3C7'} };
            else if (r.status === 'Tidak Hadir') statusCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFEE2E2'} };
        });

        sheet.views = [{ state: 'frozen', ySplit: 3 }];

        const fileName = `Rekap_${namaUser.replace(/\s/g, '_')}_${labelPeriode.replace(/\s/g,'_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error Export Excel Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal export Excel.' });
    }
};

// ============================================================
// PDF EXPORT — Anggota (rekap pribadi)
// ============================================================
const exportLaporanAnggotaPdf = async (req, res) => {
    try {
        const userId   = req.user.id;
        const namaUser = req.user.nama;
        const { rows, labelPeriode } = await queryLaporanAnggota(userId, req.query);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const fileName = `Rekap_${namaUser.replace(/\s/g, '_')}_${labelPeriode.replace(/\s/g,'_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        doc.pipe(res);

        // Judul
        doc.fontSize(15).font('Helvetica-Bold')
           .text(`Rekap Kehadiran — ${namaUser}`, { align: 'center' });
        doc.fontSize(10).font('Helvetica')
           .text(`Periode: ${labelPeriode}`, { align: 'center' });
        doc.moveDown(0.8);

        const cols = [
            { label: 'No',      width: 30,  key: (r, i) => i + 1 },
            { label: 'Hari',    width: 65,  key: r => { const d=new Date(r.tanggal); return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()]; } },
            { label: 'Tanggal', width: 80,  key: r => new Date(r.tanggal).toLocaleDateString('id-ID') },
            { label: 'Shift',   width: 100, key: r => r.nama_shift },
            { label: 'Mulai',   width: 55,  key: r => formatJam(r.waktu_masuk) },
            { label: 'Selesai', width: 55,  key: r => formatJam(r.waktu_keluar) },
            { label: 'Durasi',  width: 80,  key: r => formatDurasi(r.durasi_menit) },
            { label: 'Status',  width: 55,  key: r => r.status },
        ];

        const rowH   = 18;
        const headerH = 22;
        let   y      = doc.y;
        const startX = doc.page.margins.left;

        const drawHeader = (yPos) => {
            let x = startX;
            doc.rect(startX, yPos, cols.reduce((s,c)=>s+c.width,0), headerH).fill('#D97706');
            cols.forEach(col => {
                doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
                   .text(col.label, x+3, yPos+6, { width: col.width-6, align:'center' });
                doc.strokeColor('#B45309').lineWidth(0.5).rect(x, yPos, col.width, headerH).stroke();
                x += col.width;
            });
            return yPos + headerH;
        };

        y = drawHeader(y);

        rows.forEach((r, i) => {
            if (y + rowH > doc.page.height - doc.page.margins.bottom) {
                doc.addPage(); y = doc.page.margins.top; y = drawHeader(y);
            }
            doc.rect(startX, y, cols.reduce((s,c)=>s+c.width,0), rowH).fill(i%2===0?'#F9FAFB':'#FFFFFF');
            let x = startX;
            cols.forEach((col, ci) => {
                let color = '#111827';
                if (ci === 7) {
                    if (r.status==='Hadir') color='#065F46';
                    else if (r.status==='Tidak Hadir') color='#991B1B';
                    else if (r.status==='Izin') color='#92400E';
                }
                const val = String(typeof col.key==='function' ? col.key(r,i) : '');
                doc.fillColor(color).fontSize(8).font('Helvetica')
                   .text(val, x+3, y+5, { width:col.width-6, align:'left', lineBreak:false });
                doc.strokeColor('#E5E7EB').lineWidth(0.3).rect(x,y,col.width,rowH).stroke();
                x += col.width;
            });
            y += rowH;
        });

        doc.moveDown(1);
        doc.fontSize(8).fillColor('#6B7280').font('Helvetica')
           .text(`Total: ${rows.length} data  |  Diekspor: ${new Date().toLocaleString('id-ID')}`, { align: 'right' });

        doc.end();
    } catch (error) {
        console.error('Error Export PDF Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal export PDF.' });
    }
};

// ============================================================
// ROUTER HANDLER — Dispatch ke PDF atau Excel
// ============================================================
const exportLaporanAdmin = (req, res) => {
    const format = (req.query.format || 'excel').toLowerCase();
    if (format === 'pdf') return exportLaporanAdminPdf(req, res);
    return exportLaporanAdminExcel(req, res);
};

const exportLaporanAnggota = (req, res) => {
    const format = (req.query.format || 'excel').toLowerCase();
    if (format === 'pdf') return exportLaporanAnggotaPdf(req, res);
    return exportLaporanAnggotaExcel(req, res);
};

module.exports = { exportLaporanAdmin, exportLaporanAnggota };
