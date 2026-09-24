"""One-time, idempotent registration of existing page images and metadata."""
import json
import re
from html import unescape
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'assets/data/site-content.json'
data = json.loads(path.read_text(encoding='utf8'))
data.setdefault('texts', {})
data['site'].setdefault('hoursEn', 'Open 24 hours')
data['site'].setdefault('brandLabel', 'KURDI MOTOR')
data['site'].setdefault('tagline', 'AUTO PARTS & SERVICE')
data['site'].setdefault('tiktokUrl', 'https://www.tiktok.com/@toko.kurditegal')
for name in ['index.html', 'about.html', 'gallery.html', 'contact.html', '404.html']:
    page = root / name
    source = page.read_text(encoding='utf8')
    def attrs(tag):
        return {k: unescape(v) for k, v in re.findall(r'([\w-]+)\s*=\s*"([^"]*)"', tag)}
    images = data['images'].setdefault(name, {})
    def image(match):
        tag = match.group(0)
        values = attrs(tag)
        key = values.get('data-cms-image', 'image-' + str(len(images)))
        if 'logo' not in values.get('class', '').split():
            images.setdefault(key, {'src': values.get('src', ''), 'alt': values.get('alt', '')})
            if 'data-cms-image' not in values:
                tag = tag.replace('<img', '<img data-cms-image="' + key + '"', 1)
        return tag
    source = re.sub(r'<img\b[^>]*>', image, source)
    texts = data['texts'].setdefault(name, {})
    def text_node(match):
        tag, attr_text, value = match.groups()
        values = attrs(attr_text)
        if 'data-i18n' in values or values.get('id') in ['yearNow', 'langToggle', 'hoursText', 'hoursTextFoot', 'addressText', 'phoneText'] or not value.strip() or value.strip() == 'AUTO PARTS &amp; SERVICE':
            return match.group(0)
        if value.strip().startswith('Jl. Raya Babadan'):
            if values.get('data-cms-text'):
                texts.pop(values['data-cms-text'], None)
                attr_text = re.sub(r'\s*data-cms-text="[^"]+"', '', attr_text)
            return '<' + tag + attr_text + '>' + value + '</' + tag + '>'
        key = values.get('data-cms-text', 'text-' + str(len(texts)))
        texts.setdefault(key, unescape(value.strip()))
        if 'data-cms-text' not in values:
            attr_text += ' data-cms-text="' + key + '"'
        return '<' + tag + attr_text + '>' + value + '</' + tag + '>'
    source = re.sub(r'<(p|h1|h2|h3|h4|span|strong|small|a|label)(\s[^>]*|)>([^<>]+)</\1\s*>', text_node, source)
    description = next((attrs(m)['content'] for m in re.findall(r'<meta\b[^>]*>', source) if attrs(m).get('name') == 'description'), '')
    keys = list(dict.fromkeys(re.findall(r'data-i18n="([^"]+)"', source) + re.findall(r'data-i18n-attr="[^:"]+:([^"]+)"', source)))
    data['pages'].setdefault(name, {'title': unescape(re.search(r'<title>(.*?)</title>', source, re.S)[1].strip()), 'description': description, 'keys': keys})
    data['pages'][name]['keys'] = keys
    if 'assets/js/content.js' not in source:
        source = source.replace('</body>', '  <script src="assets/js/content.js"></script>\n  </body>')
    page.write_text(source, encoding='utf8')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
