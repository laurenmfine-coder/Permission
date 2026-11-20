"""Build curated site images from tools/img/manifest.json.

Each entry: {"out": "img/p/name.jpg", "src": "https://...", "mode": "studio" | "photo",
             "w": 900, "h": 900, "fill": 0.72}
studio: product shot, white background removed, centred on the site's cream backdrop
        with a soft contact shadow. photo: cover-crop to w x h.
Existing outputs are skipped unless the entry has "force": true.
"""
import io, json, os, sys
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CREAM = (243, 239, 233)
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*'}

def fetch(url):
    if not url.startswith('http'):
        im = Image.open(os.path.join(ROOT, url.lstrip('/')))
    else:
        r = requests.get(url, headers=UA, timeout=40)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content))
    im.load()
    if max(im.size) > 1400:
        im.thumbnail((1400, 1400), Image.LANCZOS)
    return im

def border_stats(rgb):
    w, h = rgb.size
    px = rgb.load()
    step = max(1, min(w, h) // 80)
    pts = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
          [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    cols = sorted(px[p] for p in pts)
    med = tuple(sorted(c[i] for c in cols)[len(cols) // 2] for i in range(3))
    near = sum(1 for c in cols if max(abs(c[i] - med[i]) for i in range(3)) <= 14) / len(cols)
    return pts, med, near

def knock_out_bg(im, everywhere=False):
    """Remove a flat background of any colour by flooding inward from the border.
    Returns None when the border is not a flat colour (lifestyle photo)."""
    im = im.convert('RGBA')
    if im.getextrema()[3][0] < 250:      # already has transparency
        return im
    rgb = im.convert('RGB')
    pts, med, near = border_stats(rgb)
    if near < 0.80:
        return None
    work = rgb.copy()
    SENT = (255, 0, 254)
    for p in pts:
        c = work.getpixel(p)
        if c != SENT and max(abs(c[i] - med[i]) for i in range(3)) <= 14:
            ImageDraw.floodfill(work, p, SENT, thresh=16)
    mask = Image.new('L', work.size, 255)
    wp, mp = work.load(), mask.load()
    W, H = work.size
    for y in range(H):
        for x in range(W):
            c = wp[x, y]
            if c == SENT or (everywhere and max(abs(c[i] - med[i]) for i in range(3)) <= 12):
                mp[x, y] = 0
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    return im

def contain(im, W, H, fill):
    """Whole image, uncropped, on a tile filled with the photo's own backdrop colour."""
    rgb = trim_margins(im.convert('RGB'))
    _, med, _ = border_stats(rgb)
    s = min(W * 0.9 / rgb.width, H * fill / rgb.height)
    rgb = rgb.resize((int(rgb.width * s), int(rgb.height * s)), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), med)
    canvas.paste(rgb, ((W - rgb.width) // 2, (H - rgb.height) // 2))
    return canvas

def studio(im, W, H, fill, everywhere=False):
    cut = knock_out_bg(im, everywhere)
    if cut is None:                      # busy background: fill the tile instead
        return photo(im, W, H)
    im = cut
    bbox = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    s = min(W * 0.80 / im.width, H * fill / im.height)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), CREAM + (255,))
    x = (W - im.width) // 2
    base = int(H * (0.5 + fill / 2)) + int(H * 0.02)
    y = min(H - im.height - int(H * 0.06), base - im.height)
    # soft contact shadow
    sh = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(sh)
    sw = int(im.width * 0.78)
    d.ellipse([W // 2 - sw // 2, y + im.height - int(H * 0.018), W // 2 + sw // 2, y + im.height + int(H * 0.026)], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(H * 0.022))
    shadow = Image.new('RGBA', (W, H), (60, 48, 36, 0))
    shadow.putalpha(sh)
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(im, (x, y))
    return canvas.convert('RGB')

def trim_margins(rgb):
    """Crop away a plain near-white margin around a framed product shot."""
    g = rgb.convert('L').point(lambda v: 0 if v >= 246 else 255)
    box = g.getbbox()
    if not box:
        return rgb
    w, h = rgb.size
    if (box[2] - box[0]) * (box[3] - box[1]) < 0.35 * w * h:
        return rgb      # the "margin" is real background around a small product
    return rgb.crop(box)

def photo(im, W, H):
    rgb = trim_margins(im.convert('RGB'))
    return ImageOps.fit(rgb, (W, H), Image.LANCZOS, centering=(0.5, 0.45))

def main():
    man = json.load(open(os.path.join(ROOT, 'tools/img/manifest.json')))
    report = {}
    for e in man:
        out = os.path.join(ROOT, e['out'])
        if os.path.exists(out) and not e.get('force'):
            report[e['out']] = 'exists'
            continue
        try:
            im = fetch(e['src'])
            W, H = e.get('w', 900), e.get('h', 900)
            mode = e.get('mode', 'studio')
            if mode == 'studio':
                res = studio(im, W, H, e.get('fill', 0.72), e.get('knock') == 'all')
            elif mode == 'contain':
                res = contain(im, W, H, e.get('fill', 0.9))
            else:
                res = photo(im, W, H)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            res.save(out, 'JPEG', quality=e.get('q', 84), optimize=True, progressive=True)
            report[e['out']] = 'ok %dKB' % (os.path.getsize(out) // 1024)
        except Exception as ex:
            report[e['out']] = 'ERROR %s' % str(ex)[:160]
        print(e['out'], report[e['out']])
    json.dump(report, open(os.path.join(ROOT, 'tools/img/report.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
