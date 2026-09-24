export function parseCSV(source) {
  const rows = []; let row = [], value = '', quoted = false;
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') { if (quoted && source[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if (c === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (quoted) throw new Error('Format CSV tidak lengkap.');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const columns = rows.shift() || [];
  return { columns, rows: rows.map(values => Object.fromEntries(columns.map((key, i) => [key, values[i] || '']))) };
}
export function writeCSV({ columns, rows }) {
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(quote).join(',')).join('\n') + '\n';
}
export const validImage = value => typeof value === 'string' && /^assets\/img\/[\w .%/-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes('..');
export function validate(content, products, baselineProducts = { rows: [] }) {
  if (content.version !== 1) throw new Error('Versi konten tidak dikenal.');
  if (!/^\d{8,15}$/.test(content.site.phoneIntl)) throw new Error('WhatsApp harus 8–15 digit, contoh 6285731044137.');
  if (!content.site.name.trim()) throw new Error('Nama toko wajib diisi.');
  if (!validImage(content.site.logo)) throw new Error('Pilih gambar logo PNG, JPG, atau WebP.');
  const social = new URL(content.site.tiktokUrl);
  if (social.protocol !== 'https:' || !/(^|\.)tiktok\.com$/.test(social.hostname)) throw new Error('Tautan TikTok harus HTTPS dari tiktok.com.');
  for (const key of ['mapsUrl','mapEmbedUrl']) {
    const url = new URL(content.site[key]);
    if (url.protocol !== 'https:' || !/(^|\.)google\.com$|^maps\.app\.goo\.gl$/.test(url.hostname)) throw new Error('Tautan peta harus HTTPS dari Google Maps.');
  }
  if (content.gallery.length > 100) throw new Error('Maksimal 100 foto galeri.');
  for (const image of [...content.gallery, ...Object.values(content.images).flatMap(Object.values)]) if (!validImage(image.src)) throw new Error('Lokasi foto tidak valid. Gunakan tombol unggah.');
  const ids = new Map(), baselineIds = new Map();
  for (const row of baselineProducts.rows) baselineIds.set(row.id, (baselineIds.get(row.id) || 0) + 1);
  for (const row of products.rows) {
    ids.set(row.id, (ids.get(row.id) || 0) + 1);
    if (!row.id.trim() || ids.get(row.id) > Math.max(1, baselineIds.get(row.id) || 0)) throw new Error('ID produk wajib diisi dan tidak boleh menambah duplikat: ' + row.id);
    if (!row.name_id.trim()) throw new Error('Nama produk wajib diisi: ' + row.id);
    if (!/^\d+$/.test(row.price) || !Number.isSafeInteger(Number(row.price))) throw new Error('Harga produk harus bilangan rupiah utuh: ' + row.id);
    if (row.img && !validImage(row.img)) throw new Error('Foto produk harus berasal dari folder gambar toko: ' + row.id);
  }
}
export function differences(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => differences(before[key], after[key], path ? path + '.' + key : key));
  return [{ path, before: String(before ?? '(kosong)'), after: String(after ?? '(dihapus)') }];
}
