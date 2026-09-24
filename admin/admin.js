import { parseCSV, writeCSV, validate, differences, validImage } from './model.js';
if (window.top !== window.self) { document.body.replaceChildren(); throw new Error('Buka panel langsung, bukan melalui sematan.'); }

const OWNER = 'tokokurdimotor';
const REPO = '/repos/' + OWNER + '/tokokurdimotor.github.io';
const CONTENT = 'assets/data/site-content.json', PRODUCTS = 'assets/data/products.csv';
const pageNames = { 'index.html': 'Beranda', 'about.html': 'Tentang toko', 'gallery.html': 'Galeri', 'contact.html': 'Kontak', '404.html': 'Halaman tidak ditemukan' };
const $ = selector => document.querySelector(selector);
let token = '', content, products, original, originalProducts, baseHead, baseTree, files = {}, uploads = new Map(), active = 'site', selectedPage = 'index.html', busy = false, pendingUploads = 0;
const editor = $('#editor');
function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); if (message) $('#status').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
function element(tag, text, parent, attributes = {}) {
  const el = document.createElement(tag); if (text !== null) el.textContent = text;
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  parent?.append(el); return el;
}
async function api(path, method = 'GET', body) {
  if (!token) throw new Error('Silakan masuk kembali.');
  let response;
  try { response = await fetch('https://api.github.com' + path, { method, cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch (_) { throw new Error('Koneksi GitHub terputus. Periksa internet. Jika terjadi saat menerbitkan, muat ulang data sebelum mencoba lagi.'); }
  if (!response.ok) {
    const messages = { 401: 'Token tidak valid atau sudah kedaluwarsa. Keluar lalu masuk dengan token baru.', 403: 'GitHub menolak akses. Pastikan izin Contents: Read and write, masa berlaku token, dan batas API.', 404: 'Repositori atau file tidak ditemukan. Pastikan token dipilih untuk tokokurdimotor.github.io.', 409: 'Ada perubahan lain di GitHub. Ekspor draf, lalu muat ulang sebelum menerbitkan.', 422: 'GitHub menolak perubahan. Cabang mungkin berubah atau dilindungi. Ekspor draf lalu muat ulang data.' };
    throw new Error(messages[response.status] || 'GitHub gagal memproses permintaan (' + response.status + ').');
  }
  return response.status === 204 ? null : response.json();
}
const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function readFile(path, ref) {
  const file = await api(REPO + '/contents/' + path + '?ref=' + ref);
  if (file.encoding !== 'base64') throw new Error('File terlalu besar untuk editor: ' + path);
  return { text: decode(file.content), sha: file.sha };
}
function dirty() { return !!content && (uploads.size > 0 || JSON.stringify(content) !== JSON.stringify(original) || writeCSV(products) !== writeCSV(originalProducts)); }
function changed() { $('#dirty').textContent = dirty() ? 'Ada draf yang belum diterbitkan.' : 'Semua perubahan sudah tersimpan di GitHub.'; }
function field(parent, label, value, onChange, options = {}) {
  const wrap = element('div', null, parent, { class: 'field' });
  const id = 'field-' + crypto.randomUUID(); element('label', label, wrap, { for: id });
  const input = element(options.multiline ? 'textarea' : 'input', null, wrap, { id, ...(options.multiline ? {} : { type: options.type || 'text' }) });
  input.value = value ?? ''; if (options.inputmode) input.inputMode = options.inputmode;
  input.addEventListener('input', () => { onChange(input.value); changed(); });
  return input;
}
function button(parent, label, handler, secondary = true) { const el = element('button', label, parent, secondary ? { class: 'secondary', type: 'button' } : { type: 'button' }); el.addEventListener('click', handler); return el; }
function imageURL(path) { return uploads.get(path)?.preview || '../' + path; }
function photo(parent, label, src, onChange) {
  const preview = element('img', null, parent, { class: 'image', alt: label, src: imageURL(src) });
  const id = 'upload-' + crypto.randomUUID(); element('label', label + ' · unggah pengganti', parent, { for: id });
  const input = element('input', null, parent, { id, type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    pendingUploads++;
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('Ukuran foto maksimal 4 MB.');
      if (uploads.size >= 20) throw new Error('Terbitkan 20 foto ini dahulu sebelum mengunggah lagi.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
      if (!png && !jpg && !webp) throw new Error('Gunakan gambar PNG, JPG, atau WebP yang valid.');
      const bitmap = await createImageBitmap(file); bitmap.close();
      const path = 'assets/img/uploads/' + crypto.randomUUID() + (png ? '.png' : jpg ? '.jpg' : '.webp');
      let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const entry = { base64: btoa(binary), preview: URL.createObjectURL(file) }; uploads.set(path, entry);
      preview.src = entry.preview; onChange(path); changed(); status('Foto siap dalam draf. Tinjau lalu terbitkan agar tampil di website.');
    } catch (error) { status(error.message, true); input.value = ''; }
    finally { pendingUploads--; }
  });
}
function renderSite() {
  element('h2', 'Identitas & kontak', editor); element('p', 'Kelola identitas utama yang dipakai di seluruh website.', editor);
  const grid = element('div', null, editor, { class: 'grid' });
  const labels = { name: 'Nama toko', brandLabel: 'Tulisan merek di header', tagline: 'Tagline di bawah merek', phoneIntl: 'WhatsApp · format 628…', phoneDisplay: 'Nomor yang ditampilkan', hours: 'Jam buka Indonesia', hoursEn: 'Jam buka Inggris', address: 'Alamat lengkap', mapsQuery: 'Lokasi pencarian peta', mapsUrl: 'Tautan Google Maps', mapEmbedUrl: 'URL sematan Google Maps', tiktokUrl: 'Tautan TikTok toko' };
  for (const [key, label] of Object.entries(labels)) field(grid, label, content.site[key], value => { content.site[key] = value; }, { multiline: ['address', 'mapEmbedUrl'].includes(key) });
  photo(editor, 'Logo toko', content.site.logo, value => { content.site.logo = value; });
  element('p', 'Tulisan promosi jam buka di beranda dan versi bahasa Inggris dapat diubah di Konten halaman.', editor, { class: 'hint' });
}
function renderPages() {
  element('h2', 'Konten halaman', editor); element('p', 'Ubah judul, teks dalam dua bahasa, dan foto. Tata letak tetap terjaga. Teks yang dipakai bersama akan berubah di semua halaman terkait.', editor);
  const selectId = 'page-selector'; element('label', 'Pilih halaman', editor, { for: selectId });
  const select = element('select', null, editor, { id: selectId });
  for (const [key, name] of Object.entries(pageNames)) element('option', name, select, { value: key });
  select.value = selectedPage; select.onchange = () => { selectedPage = select.value; render(); };
  const meta = content.pages[selectedPage];
  field(editor, 'Judul tab / hasil pencarian', meta.title, value => { meta.title = value; });
  field(editor, 'Deskripsi pencarian', meta.description, value => { meta.description = value; }, { multiline: true });
  const search = field(editor, 'Cari teks pada halaman ini', '', () => {});
  const list = element('div', null, editor);
  const groups = [];
  for (const key of meta.keys) {
    if (!(key in content.translations.id)) continue;
    const section = element('div', null, list, { class: 'photo-card' }); groups.push({ section, key });
    element('span', key, section, { class: 'pill' }); const grid = element('div', null, section, { class: 'grid' });
    for (const [lang, label] of [['id', 'Bahasa Indonesia'], ['en', 'Bahasa Inggris']]) field(grid, label, content.translations[lang][key], value => { content.translations[lang][key] = value; }, { multiline: true });
  }
  search.oninput = () => { const term = search.value.toLowerCase(); groups.forEach(({ section, key }) => { section.hidden = ![key, content.translations.id[key], content.translations.en[key]].join(' ').toLowerCase().includes(term); }); };
  const extraTexts = Object.entries(content.texts?.[selectedPage] || {});
  if (extraTexts.length) {
    const details = element('details', null, editor); element('summary', 'Teks tambahan · berlaku di kedua bahasa', details);
    for (const [key, text] of extraTexts) field(details, text.slice(0, 70), text, value => { content.texts[selectedPage][key] = value; }, { multiline: true });
  }
  if (selectedPage !== 'gallery.html') for (const [key, image] of Object.entries(content.images[selectedPage])) {
    const card = element('div', null, editor, { class: 'photo-card' });
    photo(card, 'Foto halaman · ' + key, image.src, value => { image.src = value; });
    field(card, 'Deskripsi foto', image.alt, value => { image.alt = value; });
  }
}
function renderGallery() {
  element('h2', 'Galeri foto', editor); element('p', 'Tambah, ganti, urutkan, atau hapus foto dari tampilan galeri. File lama tetap tersimpan dalam riwayat GitHub.', editor);
  content.gallery.forEach((item, index) => {
    const card = element('div', null, editor, { class: 'photo-card' }); element('h3', 'Foto ' + (index + 1), card);
    photo(card, 'Foto galeri', item.src, value => { item.src = value; });
    const grid = element('div', null, card, { class: 'grid' });
    for (const [lang, label] of [['id', 'Deskripsi Indonesia'], ['en', 'Deskripsi Inggris']]) field(grid, label, item.alt[lang], value => { item.alt[lang] = value; });
    const actions = element('div', null, card, { class: 'actions' });
    if (index) button(actions, 'Naik', () => { [content.gallery[index - 1], content.gallery[index]] = [item, content.gallery[index - 1]]; changed(); render(); });
    button(actions, 'Hapus dari galeri', () => { if (confirm('Hapus foto ini dari galeri? Perubahan baru berlaku setelah diterbitkan.')) { content.gallery.splice(index, 1); changed(); render(); } });
  });
  button(editor, '+ Tambah foto', () => { content.gallery.push({ src: content.site.logo, alt: { id: 'Foto bengkel', en: 'Workshop photo' } }); changed(); render(); });
}
function renderProducts() {
  element('h2', 'Data produk', editor);
  element('p', 'Data ini tersimpan di daftar produk toko. Website saat ini menampilkan kategori sparepart dan konsultasi WhatsApp, belum menampilkan seluruh produk atau harga satu per satu.', editor, { class: 'notice' });
  const search = field(editor, 'Cari nama, merek, atau kode produk', '', () => {});
  element('p', products.rows.length + ' produk · maksimal 30 hasil ditampilkan. Cari untuk menemukan produk lainnya.', editor, { class: 'hint' });
  const list = element('div', null, editor);
  function rows() {
    list.replaceChildren();
    const term = search.value.toLowerCase();
    const matches = products.rows.filter(row => [row.id, row.name_id, row.brand, row.sku].join(' ').toLowerCase().includes(term)).slice(0, 30);
    if (!matches.length) element('p', 'Tidak ada produk yang cocok.', list);
    for (const row of matches) {
      const details = element('details', null, list, { class: 'product-row' });
      const summary = element('summary', row.name_id + ' · Rp' + Number(row.price).toLocaleString('id-ID'), details);
      const grid = element('div', null, details, { class: 'grid' });
      const names = { id: 'ID unik', name_id: 'Nama Indonesia', name_en: 'Nama Inggris', brand: 'Merek', sku: 'Kode SKU', price: 'Harga rupiah', badge: 'Kategori / label', vehicles: 'Kendaraan', compat_id: 'Kecocokan Indonesia', compat_en: 'Kecocokan Inggris' };
      for (const [key, label] of Object.entries(names)) field(grid, label, row[key], value => { row[key] = value; summary.textContent = row.name_id + ' · Rp' + Number(row.price).toLocaleString('id-ID'); }, { inputmode: key === 'price' ? 'numeric' : 'text' });
      if (row.img) element('img', null, details, { src: imageURL(row.img), class: 'image', alt: row.name_id });
      photo(details, 'Foto produk', row.img || content.site.logo, value => { row.img = value; });
      button(details, 'Hapus produk', () => { if (confirm('Hapus produk ' + row.name_id + ' dari daftar?')) { products.rows.splice(products.rows.indexOf(row), 1); changed(); rows(); } });
    }
  }
  search.oninput = rows; rows();
  button(editor, '+ Tambah produk', () => { const row = Object.fromEntries(products.columns.map(key => [key, ''])); Object.assign(row, { id: 'P-' + Date.now(), name_id: 'Produk baru', price: '0' }); products.rows.unshift(row); search.value = row.id; rows(); list.querySelector('details').open = true; changed(); });
}
function renderReview() {
  element('h2', 'Tinjau & terbitkan', editor);
  element('p', 'Periksa perubahan di bawah. Terbitkan menyimpannya ke GitHub; GitHub Pages kemudian memperbarui website. Proses tayang dapat memerlukan beberapa menit.', editor);
  const diff = [...differences(original, content), ...differences(originalProducts.rows, products.rows, 'produk')];
  element('p', diff.length + ' perubahan kolom · ' + uploads.size + ' foto baru', editor, { class: 'pill' });
  for (const entry of diff.slice(0, 150)) {
    const row = element('div', null, editor, { class: 'review-row' }); element('strong', entry.path, row); element('del', entry.before.slice(0, 300), row); element('ins', entry.after.slice(0, 300), row);
  }
  if (diff.length > 150) element('p', 'Perubahan lainnya disertakan. Ekspor draf untuk melihat seluruh data.', editor);
  const actions = element('div', null, editor, { class: 'actions' });
  const publishButton = button(actions, 'Terbitkan ke website', publish, false); publishButton.disabled = !dirty();
  button(actions, 'Ekspor draf', exportDraft);
  button(actions, 'Muat ulang data GitHub', async () => { if (!dirty() || confirm('Buang draf yang belum diterbitkan dan muat data GitHub? Ekspor draf dahulu bila masih diperlukan.')) await run(async () => { await load(); render(); status('Data terbaru sudah dimuat.'); }); });
  button(actions, 'Impor draf', () => $('#import-draft').click());
  const input = element('input', null, editor, { type: 'file', accept: '.json,application/json', id: 'import-draft', hidden: '' });
  input.onchange = async () => { try {
    if (!input.files[0]) return; if (input.files[0].size > 120 * 1024 * 1024) throw new Error('Draf terlalu besar.');
    const data = JSON.parse(await input.files[0].text()); validate(data.content, data.products, originalProducts);
    if (!confirm('Ganti draf saat ini dengan isi file impor?')) return;
    // Only import data, never credentials, code, arbitrary repository paths or remote requests.
    const importedUploads = new Map();
    for (const [path, entry] of data.uploads || []) {
      if (!/^assets\/img\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(path) || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64) || entry.base64.length > 5600000) throw new Error('Foto dalam draf tidak valid.');
      const bytes = Uint8Array.from(atob(entry.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: path.endsWith('.png') ? 'image/png' : path.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' });
      const bitmap = await createImageBitmap(blob); bitmap.close(); importedUploads.set(path, { base64: entry.base64, preview: URL.createObjectURL(blob) });
    }
    clearUploads(); uploads = importedUploads; content = data.content; products = data.products; changed(); render(); status('Draf diimpor. Periksa perubahan sebelum menerbitkan.');
  } catch (error) { status('Draf gagal diimpor: ' + error.message, true); } };
}
function clearUploads() { for (const entry of uploads.values()) URL.revokeObjectURL(entry.preview); uploads.clear(); }
function exportDraft() {
  const data = { content, products, uploads: [...uploads].map(([path, value]) => [path, { base64: value.base64 }]) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = element('a', null, document.body, { href: url, download: 'kurdi-motor-draf.json' }); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Draf diekspor tanpa token. File berisi konten dan foto yang belum diterbitkan.');
}
function render() {
  editor.replaceChildren(); document.querySelectorAll('[data-tab]').forEach(el => { if (el.dataset.tab === active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  ({ site: renderSite, pages: renderPages, gallery: renderGallery, products: renderProducts, review: renderReview })[active]();
}
async function load() {
  const ref = await api(REPO + '/git/ref/heads/main'); const commit = await api(REPO + '/git/commits/' + ref.object.sha);
  const result = await Promise.all([CONTENT, PRODUCTS, ...Object.keys(pageNames)].map(async path => [path, await readFile(path, ref.object.sha)]));
  const nextFiles = Object.fromEntries(result); const nextContent = JSON.parse(nextFiles[CONTENT].text), nextProducts = parseCSV(nextFiles[PRODUCTS].text);
  baseHead = ref.object.sha; baseTree = commit.tree.sha; files = nextFiles; content = nextContent; products = nextProducts;
  original = structuredClone(content); originalProducts = structuredClone(products); clearUploads(); changed();
}
function staticPage(source, name) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  for (const el of doc.querySelectorAll('[data-i18n]')) {
    const value = content.translations.id[el.dataset.i18n]; if (typeof value === 'string') el.textContent = value;
  }
  for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
    const [attr, key] = el.dataset.i18nAttr.split(':'); if (['placeholder', 'title', 'aria-label'].includes(attr) && typeof content.translations.id[key] === 'string') el.setAttribute(attr, content.translations.id[key]);
  }
  doc.title = content.pages[name].title;
  doc.querySelector('meta[name="description"]')?.setAttribute('content', content.pages[name].description);
  doc.querySelectorAll('img.logo').forEach(img => { img.src = content.site.logo; });
  doc.querySelectorAll('.brand-lockup > strong').forEach(el => { el.firstChild.textContent = content.site.brandLabel; });
  doc.querySelectorAll('.brand-lockup > small').forEach(el => { el.textContent = content.site.tagline; });
  doc.querySelectorAll('[data-cms-text]').forEach(el => { const value = content.texts?.[name]?.[el.dataset.cmsText]; if (typeof value === 'string') el.textContent = value; });
  for (const img of doc.querySelectorAll('[data-cms-image]')) { const image = content.images[name][img.dataset.cmsImage]; if (image) { img.setAttribute('src', image.src); img.removeAttribute('srcset'); img.alt = image.alt; } }
  const grid = doc.querySelector('#galleryGrid'); if (grid) { grid.replaceChildren(); for (const image of content.gallery) { const img = doc.createElement('img'); img.setAttribute('src', image.src); img.alt = image.alt.id; img.loading = 'lazy'; img.width = 1600; img.height = 1200; grid.append(img); } }
  doc.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => { const url = new URL(link.getAttribute('href')); url.pathname = '/' + content.site.phoneIntl; link.setAttribute('href', url.href); if (link.id === 'phoneText' || link.classList.contains('footer-phone')) link.firstChild.textContent = content.site.phoneDisplay + ' '; });
  doc.querySelectorAll('#addressText, .footer-grid > div:last-child > p').forEach(el => { el.textContent = content.site.address; });
  doc.querySelectorAll('#hoursText,#hoursTextFoot').forEach(el => { el.textContent = content.site.hours; });
  doc.querySelector('#mapBtn')?.setAttribute('href', content.site.mapsUrl); doc.querySelector('#mapFrame')?.setAttribute('src', content.site.mapEmbedUrl);
  doc.querySelectorAll('a[href*="tiktok.com/"]').forEach(el => { el.setAttribute('href', content.site.tiktokUrl); });
  // Version the content loader on every publication, independently of workflow timing.
  doc.querySelector('script[src^="assets/js/content.js"]')?.setAttribute('src', 'assets/js/content.js?v=' + Date.now());
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML + '\n';
}
async function publish() {
  await run(async () => {
    if (pendingUploads) throw new Error('Tunggu sampai foto selesai diproses sebelum menerbitkan.');
    validate(content, products, originalProducts);
    if (!dirty()) return;
    if (!confirm('Terbitkan perubahan ini ke website Kurdi Motor?')) return;
    status('Memeriksa versi terbaru di GitHub…');
    const head = await api(REPO + '/git/ref/heads/main');
    if (head.object.sha !== baseHead) throw new Error('Ada perubahan baru di GitHub sejak panel dibuka. Ekspor draf, muat ulang data, lalu impor draf dan tinjau lagi. Website belum diubah.');
    const tree = [];
    const documents = { [CONTENT]: JSON.stringify(content, null, 2) + '\n', [PRODUCTS]: writeCSV(products) };
    for (const name of Object.keys(pageNames)) documents[name] = staticPage(files[name].text, name);
    for (const [path, text] of Object.entries(documents)) {
      if (text === files[path].text) continue;
      const blob = await api(REPO + '/git/blobs', 'POST', { content: text, encoding: 'utf-8' }); tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const [path, entry] of uploads) { status('Mengunggah foto…'); const blob = await api(REPO + '/git/blobs', 'POST', { content: entry.base64, encoding: 'base64' }); tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha }); }
    const createdTree = await api(REPO + '/git/trees', 'POST', { base_tree: baseTree, tree });
    const commit = await api(REPO + '/git/commits', 'POST', { message: 'feat(content): terbitkan konten dari panel pemilik\n\nSimpan konten dan foto yang ditinjau pemilik dalam satu revisi agar pembaruan website dapat dilacak dan dipulihkan.', tree: createdTree.sha, parents: [baseHead] });
    await api(REPO + '/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false });
    // A successful ref update means saved. Do not misreport save failure if subsequent reads fail.
    original = structuredClone(content); originalProducts = structuredClone(products); baseHead = commit.sha; baseTree = createdTree.sha;
    for (const [path, text] of Object.entries(documents)) files[path] = { text }; clearUploads(); changed(); render();
    status('Berhasil disimpan ke GitHub (' + commit.sha.slice(0, 7) + '). Website sedang diperbarui oleh GitHub Pages; biasanya perlu beberapa menit. Muat ulang halaman website setelah proses selesai.');
    element('a', 'Lihat status penerbitan di GitHub ↗', $('#status'), { href: 'https://github.com/' + OWNER + '/tokokurdimotor.github.io/actions', target: '_blank', rel: 'noopener noreferrer' });
  });
}
async function run(action) {
  if (busy) return; busy = true; document.querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = true; });
  try { await action(); } catch (error) { status(error.message, true); }
  finally { busy = false; document.querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = false; }); }
}
$('#login-form').onsubmit = event => {
  event.preventDefault(); const entered = $('#token').value.trim(); $('#token').value = '';
  run(async () => { token = entered; try {
    status('Memeriksa akses GitHub…'); const user = await api('/user'); if (user.login.toLowerCase() !== OWNER) throw new Error('Panel ini khusus akun pemilik tokokurdimotor.');
    const repo = await api(REPO); if (!repo.permissions?.push) throw new Error('Akun ini tidak memiliki izin mengubah repositori.');
    await load(); $('#login').hidden = true; $('#workspace').hidden = false; $('#account').textContent = 'Akun GitHub: ' + user.login + ' · GitHub Pages'; render(); status('Berhasil masuk. Perubahan baru tayang setelah Anda menekan Terbitkan.');
  } catch (error) { token = ''; throw error; } });
};
document.querySelectorAll('[data-tab]').forEach(el => { el.onclick = () => { active = el.dataset.tab; render(); }; });
$('#review').onclick = () => { active = 'review'; render(); editor.scrollIntoView({ block: 'start' }); };
$('#logout').onclick = () => { if (dirty() && !confirm('Keluar dan membuang draf yang belum diterbitkan?')) return; token = ''; content = undefined; products = undefined; clearUploads(); editor.replaceChildren(); $('#workspace').hidden = true; $('#login').hidden = false; status('Anda sudah keluar. Token dihapus dari sesi panel.'); };
window.addEventListener('beforeunload', event => { if (dirty() || busy) { event.preventDefault(); event.returnValue = ''; } });
