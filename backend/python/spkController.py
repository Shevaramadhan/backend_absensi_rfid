from typing import Any, Dict, List, Optional, Union
import math

try:
    from prisma import Prisma
    prisma = Prisma()
except ImportError:
    prisma = None

# Konfigurasi Waktu Shift (menit dari jam 00:00)
WAKTU_SHIFT: Dict[int, Dict[str, int]] = {
    1: {'start': 480, 'end': 600},   # 08:00 - 10:00
    2: {'start': 600, 'end': 720},   # 10:00 - 12:00
    3: {'start': 720, 'end': 840},   # 12:00 - 14:00
    4: {'start': 840, 'end': 960}    # 14:00 - 16:00
}


def _get_field(obj: Any, key: str, default: Any = None) -> Any:
    """Helper untuk mengakses atribut dari Dict maupun Objek Prisma/ORM."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def hitung_jeda(shift_terpilih: Union[int, str], kelas_krs: Optional[List[Any]]) -> Dict[str, Any]:
    """Menghitung jeda antara jam kuliah (KRS) dengan shift piket yang dipilih."""
    if not kelas_krs or len(kelas_krs) == 0:
        return {'skor': 5, 'status': '>60'}

    shift_key = int(shift_terpilih)
    shift = WAKTU_SHIFT.get(shift_key)
    if not shift:
        return {'skor': 5, 'status': '>60'}

    jeda_terkecil = float('inf')

    for k in kelas_krs:
        jam_mulai = _get_field(k, 'jamMulai') or _get_field(k, 'jam_mulai')
        jam_selesai = _get_field(k, 'jamSelesai') or _get_field(k, 'jam_selesai')

        if not jam_mulai or not jam_selesai:
            continue

        try:
            parts_start = str(jam_mulai).strip().split(':')
            parts_end = str(jam_selesai).strip().split(':')
            start_h, start_m = int(parts_start[0]), int(parts_start[1])
            end_h, end_m = int(parts_end[0]), int(parts_end[1])
        except (ValueError, AttributeError, IndexError):
            continue

        kelas_start = start_h * 60 + start_m
        kelas_end = end_h * 60 + end_m

        if kelas_start < shift['end'] and kelas_end > shift['start']:
            return {'skor': 0, 'status': 'bentrok'}

        jeda_sebelum = shift['start'] - kelas_end
        jeda_sesudah = kelas_start - shift['end']

        if jeda_sebelum >= 0 and jeda_sebelum < jeda_terkecil:
            jeda_terkecil = jeda_sebelum
        if jeda_sesudah >= 0 and jeda_sesudah < jeda_terkecil:
            jeda_terkecil = jeda_sesudah

    if jeda_terkecil < 15:
        return {'skor': 1, 'status': '<15'}
    elif jeda_terkecil <= 20:
        return {'skor': 2, 'status': '15-20'}
    elif jeda_terkecil <= 30:
        return {'skor': 3, 'status': '20-30'}
    elif jeda_terkecil <= 60:
        return {'skor': 4, 'status': '30-60'}
    
    return {'skor': 5, 'status': '>60'}


def proses_saw_logic(members: List[Any], db_kriteria: List[Any], hari: str, shift: Union[int, str]) -> List[Dict[str, Any]]:
    """Perhitungan SAW untuk kriteria piket anggota."""
    shift_num = int(shift)
    kandidat = []

    for m in members:
        jadwal_list = _get_field(m, 'jadwal', []) or []
        
        data_hari = None
        for j in jadwal_list:
            if _get_field(j, 'hari') == hari:
                data_hari = j
                break

        if not data_hari:
            continue

        is_filled = False
        for j in jadwal_list:
            sks = _get_field(j, 'sks', 0) or 0
            kelas_krs = _get_field(j, 'kelasKrs') or _get_field(j, 'kelas_krs') or []
            if sks > 0 or len(kelas_krs) > 0 or any(_get_field(j, f"shift{s}") in ['kegiatan', 'piket', 'isi'] for s in [1, 2, 3, 4]):
                is_filled = True
                break

        if not is_filled:
            continue

        status_shift = _get_field(data_hari, f"shift{shift_num}")
        if status_shift in ['kegiatan', 'piket']:
            continue

        total_kosong = 0
        for s in [1, 2, 3, 4]:
            if _get_field(data_hari, f"shift{s}") == 'kosong':
                total_kosong += 1

        if total_kosong == 0:
            c1 = 1
        elif total_kosong == 1:
            c1 = 3
        elif total_kosong == 2:
            c1 = 4
        elif total_kosong == 3:
            c1 = 5
        else:
            c1 = 2

        kelas_krs_hari = _get_field(data_hari, 'kelasKrs') or _get_field(data_hari, 'kelas_krs') or []
        cek_jeda = hitung_jeda(shift_num, kelas_krs_hari)
        if cek_jeda['status'] == 'bentrok':
            continue

        c2 = cek_jeda['skor']
        sks_val = _get_field(data_hari, 'sks', 0) or 0

        if sks_val <= 2:
            c3 = 1
        elif sks_val <= 4:
            c3 = 2
        elif sks_val <= 6:
            c3 = 3
        elif sks_val <= 8:
            c3 = 4
        else:
            c3 = 5

        jenis_kelamin = _get_field(m, 'jenis_kelamin')
        if shift_num in (1, 3):
            c4 = 3
        elif shift_num == 2 and jenis_kelamin == 'L':
            c4 = 5
        elif shift_num == 4 and jenis_kelamin == 'P':
            c4 = 5
        else:
            c4 = 1

        scores = {}
        for k in db_kriteria:
            kode = _get_field(k, 'kode')
            if kode == 'C1':
                scores[kode] = c1
            elif kode == 'C2':
                scores[kode] = c2
            elif kode == 'C3':
                scores[kode] = c3
            elif kode == 'C4':
                scores[kode] = c4
            else:
                scores[kode] = 1

        kandidat.append({
            'anggotaId': _get_field(m, 'id'),
            'nama': _get_field(m, 'nama'),
            'jenis_kelamin': jenis_kelamin,
            'sks': sks_val,
            'jeda': cek_jeda['status'],
            'c1': c1,
            'c2': c2,
            'c3': c3,
            'c4': c4,
            'scores': scores
        })

    if not kandidat:
        return []

    extremes = {}
    for k in db_kriteria:
        kode = _get_field(k, 'kode')
        values = [c['scores'][kode] for c in kandidat if kode in c['scores']]
        max_val = max(values) if values else 1
        min_val = min(values) if values else 1

        if max_val == 0:
            max_val = 1
        if min_val == 0:
            min_val = 1

        extremes[kode] = {
            'max': max_val,
            'min': min_val
        }

    for k in kandidat:
        total_v = 0.0

        for kriteria in db_kriteria:
            kode = _get_field(kriteria, 'kode')
            tipe = str(_get_field(kriteria, 'tipe', '')).lower()
            bobot = float(_get_field(kriteria, 'bobot', 0))

            skor_asli = k['scores'].get(kode, 1)
            ext = extremes[kode]

            if tipe == 'benefit':
                r = skor_asli / ext['max']
            else:
                r = 1.0 if skor_asli == 0 else (ext['min'] / skor_asli)

            total_v += r * bobot

        k['v'] = f"{total_v:.3f}"

    kandidat.sort(key=lambda x: float(x['v']), reverse=True)
    return kandidat


async def hitung_saw(req: Any, res: Any = None) -> Any:
    """Controller handler untuk HTTP request."""
    query = getattr(req, 'query', None) or (req.get('query') if isinstance(req, dict) else {}) or getattr(req, 'args', None) or {}
    
    if hasattr(req, 'query_params'):
        query = req.query_params

    hari = query.get('hari') if isinstance(query, dict) else getattr(query, 'hari', None)
    shift = query.get('shift') if isinstance(query, dict) else getattr(query, 'shift', None)

    if not hari or not shift:
        error_res = {"error": "Hari dan Shift wajib diisi"}
        if res and hasattr(res, 'status'):
            return res.status(400).json(error_res)
        return {"status": 400, "json": error_res}

    members = []
    db_kriteria = []

    if prisma and prisma.is_connected():
        members = await prisma.anggota.find_many(
            include={'jadwal': {'include': {'kelasKrs': True}}}
        )
        db_kriteria = await prisma.kriteria.find_many()
    
    hasil = proses_saw_logic(members, db_kriteria, hari, shift)

    if res and hasattr(res, 'json'):
        return res.json(hasil)
    
    return hasil


if __name__ == '__main__':
    import sys
    import json
    if len(sys.argv) > 2:
        hari_arg = sys.argv[1]
        shift_arg = sys.argv[2]
        input_data = {}
        if len(sys.argv) > 3:
            try:
                input_data = json.loads(sys.argv[3])
            except Exception:
                pass
        members_input = input_data.get('members', [])
        kriteria_input = input_data.get('kriteria', [])
        res = proses_saw_logic(members_input, kriteria_input, hari_arg, shift_arg)
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(json.dumps({'status': 'error', 'message': 'Parameter hari dan shift wajib diberikan.'}))
