export const validImage = value => typeof value === 'string' && /^assets\/img\/[\w .%/-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes('..');
export function validate(content) {
  if (content.version !== 1) throw new Error('Versi konten tidak dikenal.');
  if (!/^\d{8,15}$/.test(content.site.phoneIntl)) throw new Error('WhatsApp harus 8–15 digit, contoh 6285731044137.');
  const phone2 = content.site.phone2Intl || '';
  if (phone2 && !/^\d{8,15}$/.test(phone2)) throw new Error('WhatsApp kedua harus 8–15 digit, contoh 6285952885933, atau dikosongkan.');
  if (phone2 && !(content.site.phone2Display || '').trim()) throw new Error('Isi nomor kedua yang ditampilkan.');
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
}
export function differences(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => differences(before[key], after[key], path ? path + '.' + key : key));
  return [{ path, before: String(before ?? '(kosong)'), after: String(after ?? '(dihapus)') }];
}
