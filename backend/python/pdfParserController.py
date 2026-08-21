import os
import re
from typing import Any, Dict, List, Optional, Union

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    try:
        import PyPDF2 as pypdf
        HAS_PYPDF = True
    except ImportError:
        HAS_PYPDF = False

DAY_MAP = {
    'senin': 'Senin', 'sn': 'Senin',
    'selasa': 'Selasa', 'sl': 'Selasa',
    'rabu': 'Rabu', 'rb': 'Rabu',
    'kamis': 'Kamis', 'km': 'Kamis',
    'jumat': 'Jumat', 'jum\'at': 'Jumat', 'jm': 'Jumat',
    'sabtu': 'Sabtu', 'sb': 'Sabtu',
    'minggu': 'Minggu', 'mg': 'Minggu'
}

TIME_SINGLE_REGEX = r"(\d{1,2}[:.]\d{2})"
TIME_RANGE_REGEX = r"(\d{1,2}[:.]\d{2})\s*(?:[-–—=]|s\.?d\.?|s/d|to|/|\s+|\n)\s*(\d{1,2}[:.]\d{2})"


def format_time(t_str: str) -> str:
    """Format string waktu menjadi HH:MM 2-digit."""
    t_str = t_str.replace('.', ':').strip()
    parts = t_str.split(':')
    if len(parts) >= 2:
        hh = parts[0].zfill(2)
        mm = parts[1].zfill(2)
        return f"{hh}:{mm}"
    return t_str


def extract_raw_text(file_input: Union[str, bytes]) -> str:
    """Mengekstrak seluruh teks mentah dari file PDF."""
    full_text = []

    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(file_input) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        full_text.append(text)
            if full_text:
                return "\n".join(full_text)
        except Exception as e:
            print(f"Warning: pdfplumber text extraction error: {e}")

    if HAS_PYPDF:
        try:
            reader = pypdf.PdfReader(file_input)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text.append(text)
            return "\n".join(full_text)
        except Exception as e:
            print(f"Warning: pypdf text extraction error: {e}")

    return "\n".join(full_text)


def parse_krs_pdf(file_input: Union[str, bytes]) -> Dict[str, Any]:
    """Mengekstrak data jadwal kuliah dari file PDF KRS."""
    if isinstance(file_input, str) and not os.path.exists(file_input):
        return {'status': 'error', 'total_matakuliah': 0, 'data': [], 'message': f'File {file_input} tidak ditemukan.'}

    extracted_items: List[Dict[str, Any]] = []
    seen_signatures = set()

    def add_schedule(hari: str, jam_start: str, jam_end: str, matkul: str = "", sks: int = 0):
        hari_baku = DAY_MAP.get(hari.lower(), hari.capitalize())
        jam_start = format_time(jam_start)
        jam_end = format_time(jam_end)
        
        if jam_start == jam_end:
            return

        matkul_clean = re.sub(r'\s+', ' ', matkul).strip()
        sig = f"{hari_baku}_{jam_start}_{jam_end}_{matkul_clean}"
        if sig not in seen_signatures:
            seen_signatures.add(sig)
            extracted_items.append({
                'matakuliah': matkul_clean if matkul_clean else "Mata Kuliah",
                'sks': sks,
                'hari': hari_baku,
                'jamMulai': jam_start,
                'jamSelesai': jam_end
            })

    # Ekstraksi berbasis tabel (pdfplumber)
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(file_input) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if not table or len(table) < 2:
                            continue

                        header_day_map = {}
                        for r_idx in range(min(3, len(table))):
                            row = table[r_idx]
                            for c_idx, cell in enumerate(row):
                                cell_str = str(cell).strip().lower() if cell else ''
                                if cell_str in DAY_MAP:
                                    header_day_map[c_idx] = DAY_MAP[cell_str]

                        for row in table[1:]:
                            if not row or all(c is None or str(c).strip() == '' for c in row):
                                continue

                            row_str = " ".join([str(c) for c in row if c])
                            if 'Total :' in row_str or 'Matakuliah' in row_str:
                                continue

                            matkul_val = ""
                            sks_val = 0

                            if len(row) > 4 and row[3] and not str(row[3]).isdigit():
                                matkul_val = str(row[3]).replace('\n', ' ').strip()
                                try:
                                    sks_val = int(str(row[4]).strip())
                                except (ValueError, TypeError):
                                    sks_val = 0
                            else:
                                for cell in row:
                                    cell_s = str(cell).strip()
                                    if cell_s and not cell_s.isdigit() and len(cell_s) > 4 and not re.search(r'\d{2}:\d{2}', cell_s):
                                        if 'Disetujui' not in cell_s and '/' not in cell_s:
                                            matkul_val = cell_s.replace('\n', ' ')
                                            break

                            for c_idx, cell in enumerate(row):
                                if not cell:
                                    continue
                                cell_text = str(cell).replace('\n', ' ')
                                time_m = re.search(TIME_RANGE_REGEX, cell_text)
                                if time_m:
                                    jam_m = time_m.group(1)
                                    jam_s = time_m.group(2)
                                    
                                    day_val = header_day_map.get(c_idx)
                                    if not day_val:
                                        day_match = re.search(r"(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Sn|Sl|Rb|Km|Jm|Sb)", cell_text, re.IGNORECASE)
                                        if day_match:
                                            day_val = DAY_MAP.get(day_match.group(1).lower(), 'Senin')
                                        else:
                                            day_val = 'Senin'

                                    add_schedule(day_val, jam_m, jam_s, matkul_val, sks_val)

        except Exception as e:
            print(f"Error parsing table: {e}")

    # Fallback ekstraksi teks mentah
    if not extracted_items:
        raw_text = extract_raw_text(file_input)
        if raw_text:
            lines = raw_text.split('\n')
            for line in lines:
                line_clean = line.strip()
                time_m = re.search(TIME_RANGE_REGEX, line_clean, re.IGNORECASE)
                if time_m:
                    jam_m = time_m.group(1)
                    jam_s = time_m.group(2)
                    day_m = re.search(r"(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Sn|Sl|Rb|Km|Jm|Sb)", line_clean, re.IGNORECASE)
                    day_val = DAY_MAP.get(day_m.group(1).lower(), 'Senin') if day_m else 'Senin'
                    match_sks = re.search(r"\b([1-6])\b", line_clean)
                    sks_val = int(match_sks.group(1)) if match_sks else 0

                    add_schedule(day_val, jam_m, jam_s, line_clean[:40], sks_val)

    return {
        'status': 'success',
        'total_matakuliah': len(extracted_items),
        'data': extracted_items,
        'message': f"Berhasil mengekstrak {len(extracted_items)} jadwal dari PDF."
    }


def parse_krs_handler(req: Any, res: Any = None) -> Any:
    """Controller handler untuk HTTP request."""
    file_path = None
    if isinstance(req, dict):
        file_path = req.get('file_path') or req.get('body', {}).get('file_path')
    elif hasattr(req, 'file_path'):
        file_path = getattr(req, 'file_path')
    elif hasattr(req, 'query_params'):
        file_path = req.query_params.get('file_path')

    if not file_path:
        err_msg = {'status': 'error', 'message': 'Parameter file_path wajib diberikan.'}
        if res and hasattr(res, 'status'):
            return res.status(400).json(err_msg)
        return err_msg

    result = parse_krs_pdf(file_path)
    if res and hasattr(res, 'json'):
        return res.json(result)
    return result


if __name__ == '__main__':
    import sys
    import json
    if len(sys.argv) > 1:
        res = parse_krs_pdf(sys.argv[1])
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(json.dumps({'status': 'error', 'message': 'Path file PDF tidak diberikan.'}))
