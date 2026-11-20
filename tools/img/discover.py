"""Find candidate product photos on store pages listed in tools/img/discover.json.

discover.json: {"key": ["https://store/page", ...], ...}
Writes tools/img/candidates.json (key -> list of image URLs) and one contact sheet per key in
tools/img/sheets/<key>.jpg with numbered thumbnails, so a person can pick by number.
"""
import io, json, os, re, html
from urllib.parse import urljoin
import requests
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9'}
BAD = re.compile(r'logo|icon|sprite|favicon|badge|payment|flag|swatch|placeholder|pixel|\.svg|\.gif', re.I)

def candidates(url):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    t = r.text
    found = []
    if url.endswith('products.json'):
        for prod in r.json().get('products', [])[:30]:
            if prod.get('images'):
                found.append(prod['images'][0]['src'] + '#' + prod.get('handle', ''))
        return found
    for m in re.finditer(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]*>', t, re.I):
        c = re.search(r'content=["\']([^"\']+)', m.group(0))
        if c: found.append(c.group(1))
    for m in re.finditer(r'"image"\s*:\s*(\[[^\]]*\]|"[^"]+")', t):
        found += re.findall(r'"(https?:[^"]+)"', m.group(1).replace('\\/', '/'))
    for m in re.finditer(r'(?:src|data-src|srcset|data-srcset)=["\']([^"\']+)', t):
        for part in m.group(1).split(','):
            u = part.strip().split(' ')[0]
            if re.search(r'\.(jpe?g|png|webp)|scene7|/is/image/|cdn/shop|images\.', u, re.I):
                found.append(u)
    out = []
    for u in found:
        u = html.unescape(u)
        if u.startswith('//'): u = 'https:' + u
        u = urljoin(url, u)
        if BAD.search(u) or u in out: continue
        out.append(u)
    return out[:40]

def sheet(key, urls):
    thumbs = []
    keep = []
    for u in urls:
        try:
            r = requests.get(u.split('#')[0], headers={**UA, 'Accept': 'image/*'}, timeout=20)
            im = Image.open(io.BytesIO(r.content)).convert('RGB')
            if min(im.size) < 300: continue
            im.thumbnail((220, 220))
            thumbs.append(im); keep.append(u)
        except Exception:
            pass
        if len(thumbs) >= 20: break
    if not thumbs: return keep
    cols = 5; rows = (len(thumbs) + cols - 1) // cols
    S = Image.new('RGB', (cols * 230, rows * 240), 'white')
    d = ImageDraw.Draw(S)
    for i, im in enumerate(thumbs):
        x, y = (i % cols) * 230 + 5, (i // cols) * 240 + 18
        S.paste(im, (x, y)); d.text((x, y - 15), str(i), fill='red')
    os.makedirs(os.path.join(ROOT, 'tools/img/sheets'), exist_ok=True)
    S.save(os.path.join(ROOT, 'tools/img/sheets', key + '.jpg'), quality=80)
    return keep

def main():
    spec = json.load(open(os.path.join(ROOT, 'tools/img/discover.json')))
    res = {}
    for key, pages in spec.items():
        urls, errs = [], []
        for p in pages:
            try:
                urls += [u for u in candidates(p) if u not in urls]
            except Exception as ex:
                errs.append(f'{p}: {str(ex)[:120]}')
        kept = sheet(key, urls)
        res[key] = {'images': kept, 'errors': errs}
        print(key, len(kept), errs)
    json.dump(res, open(os.path.join(ROOT, 'tools/img/candidates.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
