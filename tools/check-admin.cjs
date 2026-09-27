const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const base = process.env.SITE_URL || 'http://127.0.0.1:4173';

(async () => {
  const { validate, differences } = await import(pathToFileURL(path.join(root, 'admin/model.js')));
  // The repository is public: any data file here can be downloaded, so product and price exports must stay out.
  assert.deepEqual(fs.readdirSync(path.join(root, 'assets/data')).filter(f => /\.(csv|tsv|xlsx?)$/i.test(f)), [], 'product/price data must not be published');
  const source = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/site-content.json'), 'utf8'));
  validate(source);
  const invalid = structuredClone(source); invalid.site.phoneIntl = 'javascript:alert(1)';
  assert.throws(() => validate(invalid), /WhatsApp/);
  const invalidSecond = structuredClone(source); invalidSecond.site.phone2Intl = '0859';
  assert.throws(() => validate(invalidSecond), /WhatsApp kedua/);
  const withoutSecond = structuredClone(source); withoutSecond.site.phone2Intl = '';
  validate(withoutSecond);
  assert.equal(differences(source, structuredClone(source)).length, 0);
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  let owner = true, authorized = true, head = 'a'.repeat(40), published = 0, requests = [], blobs = [], tree;
  await page.route('https://api.github.com/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname;
    requests.push({ endpoint, method: request.method() });
    assert.equal(request.headers().authorization, 'Bearer TEST_TOKEN_ONLY');
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (!authorized) return send({ message: 'Bad credentials' }, 401);
    if (endpoint === '/user') return send({ login: owner ? 'tokokurdimotor' : 'someone-else' });
    if (endpoint.endsWith('/tokokurdimotor.github.io')) return send({ permissions: { push: true } });
    if (endpoint.endsWith('/git/ref/heads/main')) return send({ object: { sha: head } });
    if (endpoint.includes('/git/commits/') && request.method() === 'GET') return send({ tree: { sha: 'tree-original' } });
    if (endpoint.includes('/contents/')) {
      const file = decodeURIComponent(endpoint.split('/contents/')[1]);
      return send({ encoding: 'base64', content: fs.readFileSync(path.join(root, file)).toString('base64'), sha: 'sha-' + file });
    }
    if (endpoint.endsWith('/git/blobs')) { blobs.push(request.postDataJSON()); return send({ sha: 'blob-' + blobs.length }, 201); }
    if (endpoint.endsWith('/git/trees')) { tree = request.postDataJSON(); return send({ sha: 'tree-new' }, 201); }
    if (endpoint.endsWith('/git/commits')) { assert.deepEqual(request.postDataJSON().parents, ['a'.repeat(40)]); return send({ sha: 'b'.repeat(40) }, 201); }
    if (endpoint.endsWith('/git/refs/heads/main')) { assert.equal(request.postDataJSON().force, false); published++; head = 'b'.repeat(40); return send({}); }
    throw new Error('Unexpected API call: ' + endpoint);
  });
  await page.goto(base + '/admin/');
  authorized = false;
  await page.getByLabel('Token akses GitHub').fill('TEST_TOKEN_ONLY'); await page.getByRole('button', { name: 'Masuk ke panel' }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Token tidak valid'));
  assert(await page.locator('#workspace').isHidden());
  authorized = true; owner = false;
  await page.getByLabel('Token akses GitHub').fill('TEST_TOKEN_ONLY'); await page.getByRole('button', { name: 'Masuk ke panel' }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('khusus akun pemilik'));
  assert(await page.locator('#workspace').isHidden()); owner = true;
  await page.getByLabel('Token akses GitHub').fill('TEST_TOKEN_ONLY'); await page.getByRole('button', { name: 'Masuk ke panel' }).click();
  await page.locator('#workspace').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#token').inputValue(), '');
  assert.equal(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]).includes('TEST_TOKEN_ONLY')), false);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['site', 'pages', 'gallery', 'review']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'overflow ' + tab + ' at ' + width);
    }
  }
  await page.locator('[data-tab="site"]').click();
  await page.getByLabel('Nama toko', { exact: true }).fill('KURDI MOTOR TEST');
  await page.locator('input[type="file"]').setInputFiles(path.join(root, 'assets/img/logo.png'));
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Foto siap'));
  await page.route('**/assets/img/uploads/**', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(root, 'assets/img/logo.png')) }));
  assert.equal(await page.locator('[data-tab="products"]').count(), 0);
  await page.locator('[data-tab="pages"]').click();
  await page.getByLabel('Cari teks pada halaman ini').fill('modern.hero.line1');
  const hero = page.locator('.photo-card').filter({ has: page.locator('.pill', { hasText: 'modern.hero.line1' }) });
  await hero.getByLabel('Bahasa Indonesia', { exact: true }).fill('Servis terpercaya dari HP.');
  await page.getByRole('button', { name: 'Tinjau perubahan' }).click();
  assert((await page.locator('#editor').innerText()).includes('Servis terpercaya dari HP.'));
  page.on('dialog', d => d.accept());
  head = 'c'.repeat(40);
  await page.getByRole('button', { name: 'Terbitkan ke website', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Ada perubahan baru'));
  assert.equal(published, 0); assert.equal(blobs.length, 0);
  head = 'a'.repeat(40);
  await page.getByRole('button', { name: 'Terbitkan ke website', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Berhasil disimpan'));
  assert.equal(published, 1); assert.equal(tree.base_tree, 'tree-original');
  assert(tree.tree.every(entry => ['assets/data/site-content.json', 'index.html', 'about.html', 'gallery.html', 'contact.html', '404.html'].includes(entry.path) || /^assets\/img\/uploads\/[a-f0-9-]+\.png$/.test(entry.path)));
  assert(!requests.some(r => /\.csv/i.test(r.endpoint)), 'panel must not read or write CSV data');
  assert.equal(blobs.filter(b => b.encoding === 'base64').length, 1);
  const saved = JSON.parse(blobs.find(b => b.content.startsWith('{')).content); assert.equal(saved.site.name, 'KURDI MOTOR TEST');
  const home = blobs.find(b => b.content.includes('<title>') && b.content.includes('modern.hero.line1'));
  assert(home.content.includes('Servis terpercaya dari HP.'));
  assert(home.content.includes('wa.me/6285731044137') && home.content.includes('wa.me/6285952885933'), 'publishing keeps both WhatsApp numbers');
  assert(!JSON.stringify(blobs).includes('TEST_TOKEN_ONLY'));
  const dir = path.join(root, 'verification'); fs.mkdirSync(dir, { recursive: true });
  await page.locator('[data-tab="site"]').click(); await page.screenshot({ path: path.join(dir, 'admin-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 850 }); await page.screenshot({ path: path.join(dir, 'admin-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Keluar', exact: true }).click(); assert(await page.locator('#workspace').isHidden());
  // Public renderer reads saved content and retains language switching.
  await page.route('**/assets/data/site-content.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(saved) }));
  await page.route(/googletagmanager|google-analytics|google\.com\/maps/, r => r.fulfill({ body: '' }));
  await page.goto(base + '/index.html'); await page.waitForFunction(() => document.querySelector('[data-i18n="modern.hero.line1"]').textContent === 'Servis terpercaya dari HP.');
  await page.locator('#langToggle').click(); assert.notEqual(await page.locator('[data-i18n="modern.hero.line1"]').textContent(), 'Servis terpercaya dari HP.');
  assert.deepEqual(errors, []); await browser.close();
  console.log('PASS: no product/price data published, validation, denied/owner login, no token storage, 4 tabs at 3 widths, review, conflict protection, atomic publish, logout, and public rendering. GitHub writes mocked; no live content changed.');
})().catch(error => { console.error(error); process.exit(1); });
