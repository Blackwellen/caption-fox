"""Render the Link in Bio demo media into public/demo/link-in-bio/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required). Only plain photography is stored: every headline, button
and price on a link page is drawn live by the public page renderer, so the
images never carry baked-in UI text.

Every download has a deterministic gradient fallback, so a dead photo id
degrades to a designed cover instead of failing the render.

Run: python scripts/render-link-in-bio-seed-media.py
"""
import io, json, os, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo', 'link-in-bio')
os.makedirs(ROOT, exist_ok=True)

# key: (unsplash id, size, fallback gradient)
MEDIA = {
    'sneakers': ('1476480862126-209bfaa8edc8', (960, 640), ((17, 24, 39), (63, 98, 18))),
    'creator-portrait': ('1494790108377-be9c29b29330', (720, 900), ((109, 40, 217), (236, 72, 153))),
    'sunglasses': ('1572635196237-14b3f281503f', (960, 640), ((251, 207, 232), (244, 114, 182))),
    'waitlist-sky': ('1506905925346-21bda4d32df4', (960, 640), ((30, 64, 175), (147, 197, 253))),
    'app-phones': ('1511707171634-5f897ff02aa9', (960, 640), ((10, 10, 10), (55, 65, 81))),
    'plant-interior': ('1485955900006-10f4d324d411', (960, 640), ((245, 245, 240), (163, 177, 138))),
    'summer-sand': ('1519046904884-53103b34b206', (720, 1100), ((253, 230, 205), (240, 180, 140))),
    'skincare-bottles': ('1598440947619-2c35fc9aa908', (720, 720), ((250, 232, 214), (214, 170, 130))),
    'moisturizer': ('1571781926291-c477ebfd024b', (720, 720), ((245, 240, 235), (180, 150, 120))),
    'glow-bundle': ('1608248543803-ba4f8c70ae0b', (720, 720), ((250, 225, 200), (200, 140, 100))),
    'sunset-ocean': ('1507525428034-b723cf961d3e', (900, 1400), ((251, 146, 60), (190, 24, 93))),
    'earth-mountains': ('1500530855697-b586d89ba3ee', (720, 1100), ((120, 90, 60), (60, 70, 40))),
    'ocean-deep': ('1505118380757-91f5f5632de0', (720, 1100), ((12, 74, 110), (56, 189, 248))),
    'neon-night': ('1550745165-9bc0b252726f', (720, 1100), ((20, 10, 40), (168, 85, 247))),
    'botanical': ('1466781783364-36c955e42a7f', (480, 480), ((22, 101, 52), (187, 247, 208))),
    'neon-wave': ('1557672172-298e090bd0f1', (480, 480), ((91, 33, 182), (236, 72, 153))),
    'denim': ('1541099649105-f69ad21f3246', (480, 480), ((30, 58, 138), (147, 197, 253))),
    'pastel': ('1557682250-33bd709cbe85', (480, 480), ((251, 207, 232), (221, 214, 254))),
    'workspace': ('1498050108023-c5249f4df085', (480, 480), ((30, 41, 59), (100, 116, 139))),
    'influencer': ('1438761681033-6461ffad8d80', (480, 480), ((190, 18, 60), (251, 113, 133))),
}


def photo(pid, w=1600):
    url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=85&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
    try:
        data = urllib.request.urlopen(req, timeout=60).read()
        return Image.open(io.BytesIO(data)).convert('RGB')
    except Exception as exc:  # noqa: BLE001
        print(f'  ! photo-{pid} unavailable ({exc}); using gradient fallback')
        return None


def cover(im, size):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left, top = (im.width - tw) // 2, (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def gradient(size, pair):
    top, bottom = pair
    base = Image.new('RGB', size, top)
    mask = Image.linear_gradient('L').resize(size).rotate(35, expand=False)
    return Image.composite(Image.new('RGB', size, bottom), base, mask)


from PIL import ImageDraw, ImageFilter, ImageFont


def _font(size):
    for name in ('segoeuib.ttf', 'arialbd.ttf'):
        path = os.path.join('C:/Windows/Fonts', name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def product_art(size, bg, items):
    """Unbranded product still life: soft backdrop, floor shadow, simple
    bottles/jars carrying the fictional ACME demo wordmark. Drawn at 3x and
    downsampled so edges stay smooth."""
    S = 3
    w, h = size[0] * S, size[1] * S
    im = gradient((w, h), bg)
    shadow = Image.new('L', (w, h), 0)
    sd = ImageDraw.Draw(shadow)
    d = ImageDraw.Draw(im)
    floor = int(h * 0.80)
    for kind, cx, width, height, body, cap in items:
        x0, x1 = int(w * cx - w * width / 2), int(w * cx + w * width / 2)
        top = floor - int(h * height)
        sd.ellipse((x0 - 20 * S, floor - 10 * S, x1 + 40 * S, floor + 16 * S), fill=110)
    im = Image.composite(Image.new('RGB', (w, h), (120, 90, 70)), im, shadow.filter(ImageFilter.GaussianBlur(14 * S)).point(lambda v: int(v * 0.5)))
    d = ImageDraw.Draw(im)
    for kind, cx, width, height, body, cap in items:
        x0, x1 = int(w * cx - w * width / 2), int(w * cx + w * width / 2)
        top = floor - int(h * height)
        bw = x1 - x0
        if kind == 'jar':
            d.rounded_rectangle((x0, top + int(bw * 0.18), x1, floor), radius=int(bw * 0.12), fill=body)
            d.rounded_rectangle((x0 - 4 * S, top, x1 + 4 * S, top + int(bw * 0.24)), radius=int(bw * 0.08), fill=cap)
        elif kind == 'pump':
            neck = int(bw * 0.22)
            d.rounded_rectangle((x0, top + int(bw * 0.55), x1, floor), radius=int(bw * 0.22), fill=body)
            d.rectangle((x0 + bw // 2 - neck // 2, top + int(bw * 0.25), x0 + bw // 2 + neck // 2, top + int(bw * 0.58)), fill=cap)
            d.rounded_rectangle((x0 + bw // 2 - neck // 2, top + int(bw * 0.12), x1 + int(bw * 0.18), top + int(bw * 0.26)), radius=6 * S, fill=cap)
        else:  # dropper
            d.rounded_rectangle((x0, top + int(bw * 0.7), x1, floor), radius=int(bw * 0.2), fill=body)
            d.rounded_rectangle((x0 + int(bw * 0.28), top, x1 - int(bw * 0.28), top + int(bw * 0.74)), radius=int(bw * 0.2), fill=cap)
        # highlight + label
        d.rounded_rectangle((x0 + int(bw * 0.12), top + int((floor - top) * 0.45), x0 + int(bw * 0.2), floor - int((floor - top) * 0.12)), radius=4 * S, fill=tuple(min(255, c + 45) for c in body))
        f = _font(max(10, int(bw * 0.16)))
        label_y = top + int((floor - top) * 0.62)
        d.text((x0 + bw // 2, label_y), 'ACME', font=f, fill=(255, 255, 255) if sum(body) < 450 else (60, 45, 35), anchor='mm')
    return im.resize(size, Image.LANCZOS)


RENDERED = {
    'skincare-bottles': lambda: product_art((720, 720), ((252, 231, 214), (236, 196, 168)), [
        ('pump', 0.30, 0.17, 0.46, (238, 226, 212), (92, 70, 58)),
        ('dropper', 0.52, 0.15, 0.40, (201, 118, 72), (60, 44, 36)),
        ('jar', 0.73, 0.22, 0.20, (250, 246, 240), (214, 170, 130)),
    ]),
    'moisturizer': lambda: product_art((720, 720), ((250, 240, 230), (226, 205, 186)), [
        ('jar', 0.50, 0.40, 0.34, (248, 244, 238), (190, 142, 104)),
    ]),
    'glow-bundle': lambda: product_art((720, 720), ((253, 224, 196), (242, 150, 104)), [
        ('dropper', 0.27, 0.15, 0.40, (242, 107, 58), (70, 50, 40)),
        ('pump', 0.50, 0.17, 0.50, (252, 240, 226), (242, 107, 58)),
        ('jar', 0.74, 0.21, 0.21, (255, 250, 244), (242, 107, 58)),
    ]),
}

manifest = {}
for key, (pid, size, fallback) in MEDIA.items():
    if key in RENDERED:
        RENDERED[key]().save(os.path.join(ROOT, f'{key}.jpg'), 'JPEG', quality=88, optimize=True)
        manifest[key] = f'/demo/link-in-bio/{key}.jpg'
        print(f'  wrote {key}.jpg (rendered product art)')
        continue
    src = photo(pid, max(size) * 2)
    im = cover(src, size) if src else gradient(size, fallback)
    path = os.path.join(ROOT, f'{key}.jpg')
    im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)
    manifest[key] = f'/demo/link-in-bio/{key}.jpg'
    print(f'  wrote {key}.jpg {"(photo)" if src else "(fallback)"}')

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)
print('done')
