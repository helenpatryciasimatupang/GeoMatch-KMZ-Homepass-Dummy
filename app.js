'use strict';

const DEFAULT_DUMMY = `?-105
?-106
?-107
?-108
?-109
?-110
?-114
?-115
?-117
?-119
?-12
?-121
?-122
?-123
?-124
?-125
?-126
?-127
?-128
?-131
?-132
?-133
?-134
?-135
?-136
?-137
?-138
?-140
?-141
?-142
?-143
?-144
?-150
?-151
?-153
?-156
?-16
?-17
?-171
?-172
?-173
?-174
?-175
?-176
?-18
?-180
?-182
?-183
?-19
?-196
?-20
?-200
?-201
?-202
?-203
?-21
?-22
?-38
?-39
?-40
?-48
?-49
?-50
?-52
?-53
?-54
?-55
?-57
?-58
?-59
?-60
?-63
?-64
?-65
?-66
?-67
?-69
?-71
?-72
?-74
?-77
?-78
?-79
?-80
?-81
?-83
?-84
?-85
?-86
?-87
?-88
?-90
?-93
?-94
?-95
?-98
?-99`;

const $ = (id) => document.getElementById(id);
const els = {
  file: $('kmzFile'), drop: $('dropZone'), fileTitle: $('fileTitle'), fileMeta: $('fileMeta'), fileWarning: $('fileWarning'),
  clearFileBtn: $('clearFileBtn'), dummy: $('dummyInput'), dummyCount: $('dummyCount'), resetListBtn: $('resetListBtn'),
  pruneAssets: $('pruneAssets'), processBtn: $('processBtn'), statusPanel: $('statusPanel'), statusTitle: $('statusTitle'), statusText: $('statusText'),
  results: $('results'), statDummy: $('statDummy'), statFound: $('statFound'), statFoundPct: $('statFoundPct'), statMissing: $('statMissing'), statExtra: $('statExtra'),
  tabFoundCount: $('tabFoundCount'), tabMissingCount: $('tabMissingCount'), tabExtraCount: $('tabExtraCount'), tabAllCount: $('tabAllCount'),
  resultBody: $('resultBody'), emptyState: $('emptyState'), csvBtn: $('csvBtn'), downloadBtn: $('downloadBtn'), diagnostics: $('diagnostics')
};

let selectedFile = null;
let state = { found: [], missing: [], extra: [], all: [], outputBlob: null, outputName: '', duplicateKmz: [], duplicateDummy: [] };
let activeTab = 'found';

els.dummy.value = DEFAULT_DUMMY;
updateDummyCount();

els.file.addEventListener('change', () => setFile(els.file.files?.[0] || null));
els.clearFileBtn.addEventListener('click', () => setFile(null));
els.resetListBtn.addEventListener('click', () => { els.dummy.value = DEFAULT_DUMMY; updateDummyCount(); });
els.dummy.addEventListener('input', updateDummyCount);
els.processBtn.addEventListener('click', processKmz);
els.csvBtn.addEventListener('click', downloadCsv);
els.downloadBtn.addEventListener('click', downloadCleanKmz);

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  activeTab = btn.dataset.tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  renderTable();
}));

['dragenter','dragover'].forEach(evt => els.drop.addEventListener(evt, e => { e.preventDefault(); els.drop.classList.add('dragging'); }));
['dragleave','drop'].forEach(evt => els.drop.addEventListener(evt, e => { e.preventDefault(); els.drop.classList.remove('dragging'); }));
els.drop.addEventListener('drop', e => {
  const f = e.dataTransfer?.files?.[0];
  if (f) setFile(f);
});

function setFile(file) {
  selectedFile = file;
  els.file.value = '';
  els.fileWarning.classList.add('hidden');
  els.fileWarning.textContent = '';
  if (!file) {
    els.fileTitle.textContent = 'Tarik file KMZ ke sini';
    els.fileMeta.textContent = 'atau klik untuk memilih file';
    els.clearFileBtn.disabled = true;
    els.processBtn.disabled = true;
    return;
  }
  els.fileTitle.textContent = file.name;
  els.fileMeta.textContent = `${formatBytes(file.size)} • siap diproses`;
  els.clearFileBtn.disabled = false;
  els.processBtn.disabled = false;
  if (!file.name.toLowerCase().endsWith('.kmz')) {
    els.fileWarning.textContent = 'Ekstensi file bukan .kmz. Tool akan tetap mencoba membacanya sebagai ZIP/KMZ.';
    els.fileWarning.classList.remove('hidden');
  }
}

function parseDummy(text) {
  const tokens = text.match(/\?-\d+/g) || text.split(/[\n,;\t]+/).map(s => s.trim()).filter(Boolean);
  const clean = tokens.map(normalizeLabel).filter(Boolean);
  const seen = new Set(), unique = [], duplicate = [];
  for (const item of clean) {
    if (seen.has(item)) duplicate.push(item); else { seen.add(item); unique.push(item); }
  }
  return { unique, duplicate };
}
function normalizeLabel(s) { return String(s ?? '').trim().replace(/\s+/g, ' '); }
function updateDummyCount() {
  const p = parseDummy(els.dummy.value);
  els.dummyCount.textContent = `${p.unique.length} unik${p.duplicate.length ? ` • ${p.duplicate.length} duplikat` : ''}`;
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B','KB','MB','GB']; let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
function setStatus(title, text) {
  els.statusPanel.classList.remove('hidden');
  els.statusTitle.textContent = title;
  els.statusText.textContent = text;
}
function hideStatus() { els.statusPanel.classList.add('hidden'); }
function nextFrame() { return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); }

async function processKmz() {
  if (!selectedFile) return;
  const dummyParsed = parseDummy(els.dummy.value);
  if (!dummyParsed.unique.length) { alert('Daftar nomor rumah dummy masih kosong.'); return; }

  els.processBtn.disabled = true;
  els.statusPanel.querySelector('.spinner').style.display = '';
  els.downloadBtn.disabled = true;
  els.csvBtn.disabled = true;
  els.results.classList.add('hidden');
  setStatus('Membaca KMZ…', `Menyiapkan ${selectedFile.name}`);
  await nextFrame();

  try {
    const buffer = await selectedFile.arrayBuffer();
    const archive = parseZip(buffer);
    const kmlEntry = archive.entries.find(e => e.name.toLowerCase() === 'doc.kml') || archive.entries.find(e => e.name.toLowerCase().endsWith('.kml'));
    if (!kmlEntry) throw new Error('File KML tidak ditemukan di dalam KMZ.');

    setStatus('Membaca Placemark…', `KML ditemukan: ${kmlEntry.name}`);
    await nextFrame();
    const kmlBytes = await extractEntryBytes(archive.bytes, kmlEntry);
    const kmlText = new TextDecoder('utf-8').decode(kmlBytes);
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, 'application/xml');
    const parseError = xml.getElementsByTagName('parsererror')[0];
    if (parseError) throw new Error('KML tidak dapat diparse sebagai XML yang valid.');

    const placemarks = Array.from(xml.getElementsByTagNameNS('*', 'Placemark'));
    const items = placemarks.map((pm, index) => ({ pm, index, name: normalizeLabel(getDirectChildText(pm, 'name')) }));
    const kmzNames = items.map(x => x.name).filter(Boolean);
    const kmzSet = new Set(kmzNames);
    const dummySet = new Set(dummyParsed.unique);

    const found = dummyParsed.unique.filter(x => kmzSet.has(x));
    const missing = dummyParsed.unique.filter(x => !kmzSet.has(x));
    const extra = uniquePreserve(kmzNames.filter(x => !dummySet.has(x)));
    const duplicateKmz = findDuplicates(kmzNames);

    setStatus('Menyusun KMZ bersih…', `${found.length} titik dipertahankan, ${extra.length} titik di luar daftar dihapus.`);
    await nextFrame();

    for (const item of items) {
      if (!dummySet.has(item.name)) item.pm.parentNode?.removeChild(item.pm);
    }

    const serializer = new XMLSerializer();
    let newKmlText = serializer.serializeToString(xml);
    if (!newKmlText.startsWith('<?xml')) newKmlText = '<?xml version="1.0" encoding="UTF-8"?>\n' + newKmlText;
    const newKmlBytes = new TextEncoder().encode(newKmlText);

    let keepEntry = () => true;
    let referencedAssetCount = null;
    if (els.pruneAssets.checked) {
      const refs = collectLocalReferences(xml);
      referencedAssetCount = refs.size;
      keepEntry = (entry) => {
        if (entry === kmlEntry) return true;
        const n = normalizePath(entry.name);
        if (!n.startsWith('files/')) return true;
        return refs.has(n);
      };
    }

    const outBytes = buildZipReplacingEntry(archive, kmlEntry, newKmlBytes, keepEntry);
    const outputBlob = new Blob([outBytes], { type: 'application/vnd.google-earth.kmz' });
    const base = selectedFile.name.replace(/\.kmz$/i, '');
    const outputName = `${base}_SESUAI_DUMMY.kmz`;

    state = { found, missing, extra, all: uniquePreserve(kmzNames), outputBlob, outputName, duplicateKmz, duplicateDummy: dummyParsed.duplicate };
    renderResults(dummyParsed.unique.length, placemarks.length, outputBlob.size, referencedAssetCount);
    hideStatus();
  } catch (err) {
    console.error(err);
    setStatus('Gagal memproses KMZ', err?.message || String(err));
    els.statusPanel.querySelector('.spinner').style.display = 'none';
  } finally {
    els.processBtn.disabled = false;
    els.downloadBtn.disabled = !state.outputBlob;
    els.csvBtn.disabled = !state.outputBlob;
  }
}

function getDirectChildText(node, localName) {
  for (const child of node.children || []) if (child.localName === localName) return child.textContent || '';
  return '';
}
function uniquePreserve(arr) { const s = new Set(); return arr.filter(x => x && !s.has(x) && s.add(x)); }
function findDuplicates(arr) { const seen = new Set(), dup = new Set(); for (const x of arr) { if (seen.has(x)) dup.add(x); else seen.add(x); } return [...dup]; }

function collectLocalReferences(xml) {
  const refs = new Set();
  const add = raw => {
    if (!raw) return;
    let v = raw.trim().replace(/^\.\//, '');
    try { v = decodeURIComponent(v); } catch (_) {}
    if (!/^(?:https?:|data:|#)/i.test(v) && v) refs.add(normalizePath(v));
  };
  Array.from(xml.getElementsByTagNameNS('*', 'href')).forEach(n => add(n.textContent));
  Array.from(xml.getElementsByTagNameNS('*', 'description')).forEach(n => {
    const t = n.textContent || '';
    for (const m of t.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of t.matchAll(/(?:^|["'\s(])(files\/[^"'\s<>)]+)/gi)) add(m[1]);
  });
  return refs;
}
function normalizePath(p) { return String(p || '').replace(/\\/g, '/').replace(/^\.\//, ''); }

function renderResults(dummyCount, placemarkCount, outputSize, referencedAssetCount) {
  els.results.classList.remove('hidden');
  els.statDummy.textContent = dummyCount;
  els.statFound.textContent = state.found.length;
  els.statFoundPct.textContent = `${dummyCount ? ((state.found.length / dummyCount) * 100).toFixed(state.found.length === dummyCount ? 0 : 1) : 0}% cocok`;
  els.statMissing.textContent = state.missing.length;
  els.statExtra.textContent = state.extra.length;
  els.tabFoundCount.textContent = state.found.length;
  els.tabMissingCount.textContent = state.missing.length;
  els.tabExtraCount.textContent = state.extra.length;
  els.tabAllCount.textContent = state.all.length;

  const notes = [
    `<strong>${placemarkCount}</strong> Placemark dibaca dari KMZ.`,
    `KMZ keluaran: <strong>${formatBytes(outputSize)}</strong>.`
  ];
  if (referencedAssetCount !== null) notes.push(`<strong>${referencedAssetCount}</strong> referensi aset lokal terdeteksi setelah penyaringan.`);
  if (state.duplicateKmz.length) notes.push(`Duplikat label di KMZ: <strong>${escapeHtml(state.duplicateKmz.join(', '))}</strong>.`);
  if (state.duplicateDummy.length) notes.push(`Duplikat pada input dummy diabaikan: <strong>${escapeHtml(uniquePreserve(state.duplicateDummy).join(', '))}</strong>.`);
  els.diagnostics.innerHTML = notes.join(' ');
  els.diagnostics.classList.remove('hidden');
  renderTable();
  els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTable() {
  const map = {
    found: state.found.map(x => [x, 'ADA DI KMZ', 'success']),
    missing: state.missing.map(x => [x, 'TIDAK ADA', 'danger']),
    extra: state.extra.map(x => [x, 'TAMBAHAN KMZ', 'warning']),
    all: state.all.map(x => [x, state.found.includes(x) ? 'TARGET DUMMY' : (state.extra.includes(x) ? 'DI LUAR TARGET' : 'KMZ'), state.found.includes(x) ? 'success' : 'neutral'])
  };
  const rows = map[activeTab] || [];
  els.resultBody.innerHTML = rows.map((r, i) => `<tr><td>${i + 1}</td><td><code>${escapeHtml(r[0])}</code></td><td><span class="badge ${r[2]}">${r[1]}</span></td></tr>`).join('');
  els.emptyState.classList.toggle('hidden', rows.length > 0);
}
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function downloadCleanKmz() {
  if (!state.outputBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(state.outputBlob); a.download = state.outputName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadCsv() {
  const rows = [['label','status']];
  state.found.forEach(x => rows.push([x,'ADA_DI_KMZ']));
  state.missing.forEach(x => rows.push([x,'TIDAK_ADA']));
  state.extra.forEach(x => rows.push([x,'TAMBAHAN_KMZ']));
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hasil_pencocokan_kmz.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function csvCell(v) { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }

// ---------------- ZIP/KMZ engine (tanpa library eksternal) ----------------
// Mendukung ZIP standar non-encrypted dengan metode Store (0) dan Deflate (8).
function parseZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findSignatureBackwards(view, 0x06054b50, Math.max(0, bytes.length - 22 - 65535));
  if (eocdOffset < 0) throw new Error('Struktur ZIP/KMZ tidak valid: EOCD tidak ditemukan.');
  const diskNo = view.getUint16(eocdOffset + 4, true);
  const cdDisk = view.getUint16(eocdOffset + 6, true);
  const entriesTotal = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (diskNo !== 0 || cdDisk !== 0) throw new Error('ZIP multi-disk tidak didukung.');
  if (entriesTotal === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) throw new Error('ZIP64 belum didukung oleh versi tool ini.');

  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < entriesTotal; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Central Directory ZIP rusak atau tidak dikenali.');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const recordLen = 46 + nameLen + extraLen + commentLen;
    const nameBytes = bytes.slice(p + 46, p + 46 + nameLen);
    const name = decoder.decode(nameBytes);
    if (flags & 0x0001) throw new Error(`Entry terenkripsi tidak didukung: ${name}`);
    entries.push({ name, flags, method, crc, compressedSize, uncompressedSize, localOffset, centralOffset: p, centralLength: recordLen });
    p += recordLen;
  }
  return { bytes, view, entries, centralOffset: cdOffset, centralSize: cdSize, eocdOffset };
}

function findSignatureBackwards(view, sig, min) {
  for (let i = view.byteLength - 22; i >= min; i--) if (view.getUint32(i, true) === sig) return i;
  return -1;
}

function getCompressedPayload(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.localOffset;
  if (view.getUint32(p, true) !== 0x04034b50) throw new Error(`Local header tidak valid: ${entry.name}`);
  const nameLen = view.getUint16(p + 26, true);
  const extraLen = view.getUint16(p + 28, true);
  const dataStart = p + 30 + nameLen + extraLen;
  return bytes.slice(dataStart, dataStart + entry.compressedSize);
}

async function extractEntryBytes(bytes, entry) {
  const compressed = getCompressedPayload(bytes, entry);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Browser ini belum mendukung DecompressionStream. Gunakan Chrome/Edge/Firefox versi terbaru.');
    try {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([compressed]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      throw new Error(`Gagal mengekstrak ${entry.name}. Pastikan browser mendukung deflate-raw.`);
    }
  }
  throw new Error(`Metode kompresi ZIP ${entry.method} tidak didukung pada ${entry.name}.`);
}

function buildZipReplacingEntry(archive, targetEntry, replacementBytes, keepEntry) {
  const kept = archive.entries.filter(keepEntry);
  const sortedByLocal = [...archive.entries].sort((a,b) => a.localOffset - b.localOffset);
  const localEndMap = new Map();
  for (let i = 0; i < sortedByLocal.length; i++) {
    localEndMap.set(sortedByLocal[i], i + 1 < sortedByLocal.length ? sortedByLocal[i + 1].localOffset : archive.centralOffset);
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of kept) {
    if (entry === targetEntry) {
      const local = makeStoredLocalRecord(entry.name, replacementBytes);
      localParts.push(local.bytes);
      centralParts.push(makeStoredCentralRecord(entry.name, replacementBytes, local.crc, offset));
      offset += local.bytes.length;
    } else {
      const end = localEndMap.get(entry);
      const part = archive.bytes.slice(entry.localOffset, end);
      localParts.push(part);
      const central = archive.bytes.slice(entry.centralOffset, entry.centralOffset + entry.centralLength);
      const patched = central.slice();
      new DataView(patched.buffer, patched.byteOffset, patched.byteLength).setUint32(42, offset, true);
      centralParts.push(patched);
      offset += part.length;
    }
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((n,p) => n + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, kept.length, true); ev.setUint16(10, kept.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, centralOffset, true); ev.setUint16(20, 0, true);

  return concatUint8([...localParts, ...centralParts, eocd]);
}

function makeStoredLocalRecord(name, data) {
  const nameBytes = new TextEncoder().encode(name);
  const crc = crc32(data);
  const out = new Uint8Array(30 + nameBytes.length + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true); // version needed
  v.setUint16(6, 0x0800, true); // UTF-8
  v.setUint16(8, 0, true); // Store
  const { time, date } = dosDateTime(new Date());
  v.setUint16(10, time, true); v.setUint16(12, date, true);
  v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
  v.setUint16(26, nameBytes.length, true); v.setUint16(28, 0, true);
  out.set(nameBytes, 30); out.set(data, 30 + nameBytes.length);
  return { bytes: out, crc };
}

function makeStoredCentralRecord(name, data, crc, localOffset) {
  const nameBytes = new TextEncoder().encode(name);
  const out = new Uint8Array(46 + nameBytes.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true); v.setUint16(6, 20, true);
  v.setUint16(8, 0x0800, true); v.setUint16(10, 0, true);
  const { time, date } = dosDateTime(new Date());
  v.setUint16(12, time, true); v.setUint16(14, date, true);
  v.setUint32(16, crc, true); v.setUint32(20, data.length, true); v.setUint32(24, data.length, true);
  v.setUint16(28, nameBytes.length, true); v.setUint16(30, 0, true); v.setUint16(32, 0, true);
  v.setUint16(34, 0, true); v.setUint16(36, 0, true); v.setUint32(38, 0, true); v.setUint32(42, localOffset, true);
  out.set(nameBytes, 46);
  return out;
}

function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear());
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { date, time };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function concatUint8(parts) {
  const total = parts.reduce((n,p) => n + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
