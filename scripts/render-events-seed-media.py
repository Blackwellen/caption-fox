"""Render the Events demo covers into public/demo/events/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required); any photo that cannot be fetched falls back to a
designed gradient cover rendered here, so the seed never depends on network
luck. Output is deterministic and clearly demo-only.

Run: python scripts/render-events-seed-media.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo', 'events')
os.makedirs(OUT, exist_ok=True)

FONT_DIR = 'C:/Windows/Fonts'
def font(size, bold=False):
    for name in (('segoeuib.ttf', 'arialbd.ttf') if bold else ('segoeui.ttf', 'arial.ttf')):
        p = os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def fetch(pid, w=1200):
    url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=85&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=45).read())).convert('RGB')

def cover(im, size):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    return im.crop(((im.width - tw) // 2, (im.height - th) // 2,
                    (im.width - tw) // 2 + tw, (im.height - th) // 2 + th))

def designed(title, size, c1, c2):
    """Fallback cover: a deep gradient with the title set in it."""
    w, h = size
    base = Image.new('RGB', (w, h), c1)
    top = Image.new('RGB', (w, h), c2)
    mask = Image.linear_gradient('L').rotate(-25, expand=False).resize((w, h))
    base = Image.composite(top, base, mask).filter(ImageFilter.GaussianBlur(0))
    d = ImageDraw.Draw(base)
    f = font(max(20, h // 11), bold=True)
    words, lines, cur = title.upper().split(), [], ''
    for word in words:
        t = (cur + ' ' + word).strip()
        if d.textlength(t, font=f) > w - 100 and cur:
            lines.append(cur); cur = word
        else:
            cur = t
    lines.append(cur)
    y = h // 2 - len(lines) * (f.size + 8) // 2
    for line in lines:
        d.text(((w - d.textlength(line, font=f)) / 2, y), line, font=f, fill=(255, 255, 255))
        y += f.size + 8
    return base

# slug -> (candidate unsplash id, fallback title, gradient)
WIDE = {
    'product-summit':      ('1540575467063-178a50c2df87', 'Product Summit', ((26, 18, 74), (76, 45, 168))),
    'ai-marketing-trends': ('1573497019940-1c28c88b4f3e', 'AI Marketing Trends', ((12, 30, 76), (37, 99, 235))),
    'customer-success':    ('1505373877841-8d25f7d46678', 'Customer Success Live', ((49, 16, 74), (147, 51, 234))),
    'product-roadmap':     ('1516321318423-f06f85e504b3', 'Product Roadmap', ((8, 33, 66), (14, 116, 190))),
    'executive-roundtable':('1517048676732-d65bc937f952', 'Executive Roundtable', ((22, 27, 45), (71, 85, 119))),
    'partner-summit':      ('1511578314322-379afb476865', 'Partner Enablement', ((30, 20, 60), (99, 62, 196))),
    'q2-webinar':          ('1600880292203-757bb62b4baf', 'Q2 Product Updates', ((10, 28, 70), (29, 78, 216))),
    'growth-workshop':     ('1515187029135-18ee286d815b', 'Growth Workshop', ((16, 42, 66), (13, 148, 136))),
}
SQUARE = {
    'growth-dialogues':    ('1590602847861-f357a9332bbc', 'The Growth Dialogues', ((27, 17, 80), (67, 56, 202))),
    'saas-insights':       ('1559223607-a43c990c692c', 'SaaS Insights', ((15, 23, 66), (37, 99, 235))),
    'founder-stories':     ('1478737270239-2f02b77fc618', 'Founder Stories', ((46, 16, 68), (126, 34, 206))),
    'marketing-unplugged': ('1588196749597-9ff075ee6b5b', 'Marketing Unplugged', ((12, 31, 60), (8, 145, 178))),
}

manifest = {}
for group, size in ((WIDE, (1200, 675)), (SQUARE, (800, 800))):
    for slug, (pid, title, (c1, c2)) in group.items():
        path = os.path.join(OUT, f'{slug}.jpg')
        try:
            im = cover(fetch(pid), size)
            src = 'unsplash'
        except Exception as exc:                      # offline, 404, rate limit
            im = designed(title, size, c1, c2)
            src = f'designed ({type(exc).__name__})'
        im.save(path, 'JPEG', quality=86, optimize=True)
        manifest[slug] = f'/demo/events/{slug}.jpg'
        print(f'  {slug:22} {src}')

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)
print('wrote', len(manifest), 'covers to public/demo/events/')
