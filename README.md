
# GeoMatch-KMZ

Aplikasi web untuk membersihkan file KMZ berdasarkan daftar nomor rumah dummy.

## Fitur
- Upload KMZ
- Upload daftar nomor rumah (TXT/CSV)
- Mencocokkan nama titik rumah
- Menghapus titik yang tidak ada di daftar
- Download KMZ hasil filter

## Menjalankan Backend

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Buka:
http://127.0.0.1:8000/docs

