"""Render the Studio demo media into supabase/seed-media/studio/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required). Any photo that cannot be fetched falls back to a designed
cover rendered here, so the seed never depends on network luck. Branded
graphics (template covers, post creatives, documents) are designed here with the
Caption Fox mark. Everything is clearly demo-only and uploaded to the private R2
bucket by scripts/seed-studio-demo.mjs.

Run: python scripts/render-studio-seed-media.py
"""
import io, json, math, os, random, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'supabase', 'seed-media', 'studio')
os.makedirs(os.path.join(OUT, 'originals'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'thumbs'), exist_ok=True)
FOX = Image.open(os.path.join(ROOT, 'public', 'caption fox favicon.png')).convert('RGBA')

FONT_DIR = 'C:/Windows/Fonts'
def font(size, bold=False):
    for name in (('segoeuib.ttf', 'arialbd.ttf') if bold else ('segoeui.ttf', 'arial.ttf')):
        p = os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def fetch(pid, w=1600):
    url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=85&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=45).read())).convert('RGB')

def cover(im, size):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    return im.crop(((im.width - tw) // 2, (im.height - th) // 2, (im.width - tw) // 2 + tw, (im.height - th) // 2 + th))

def gradient(size, c1, c2, angle=-25):
    w, h = size
    base = Image.new('RGB', (w, h), c1)
    top = Image.new('RGB', (w, h), c2)
    mask = Image.linear_gradient('L').rotate(angle, expand=False).resize((w, h))
    return Image.composite(top, base, mask)

def fox(img, box, radius_ratio=0.22):
    x, y, s = box
    mark = FOX.resize((s, s), Image.LANCZOS)
    img.paste(mark, (x, y), mark)

def text_block(draw, xy, lines, f, fill, gap=1.12):
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=f, fill=fill)
        y += int(f.size * gap)
    return y

def glow_lines(img, colour=(40, 110, 255)):
    """Soft light-trail lines used on the dark Caption Fox creatives."""
    w, h = img.size
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(18):
        pts = []
        for x in range(0, w + 20, 20):
            y = h * 0.78 - i * 7 + math.sin(x / (w / 3.2) + i * 0.2) * h * 0.08
            pts.append((x, y))
        d.line(pts, fill=(*colour, 70 - i * 3), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(1.2))
    img.paste(layer, (0, 0), layer)

def sparkle(draw, cx, cy, r, fill):
    draw.polygon([(cx, cy - r), (cx + r * 0.18, cy - r * 0.18), (cx + r, cy), (cx + r * 0.18, cy + r * 0.18),
                  (cx, cy + r), (cx - r * 0.18, cy + r * 0.18), (cx - r, cy), (cx - r * 0.18, cy - r * 0.18)], fill=fill)

# ── Designed creatives ───────────────────────────────────────────────────────
def create_without_limits(size=(1080, 1350)):
    w, h = size
    img = gradient(size, (4, 10, 30), (10, 24, 64), -80)
    d = ImageDraw.Draw(img)
    for _ in range(60):
        x, y = random.randint(0, w), random.randint(0, h)
        d.ellipse((x, y, x + 2, y + 2), fill=(90, 140, 255))
    sparkle(d, int(w * 0.78), int(h * 0.26), 70, (70, 130, 255))
    sparkle(d, int(w * 0.2), int(h * 0.62), 30, (60, 110, 230))
    fox(img, (80, 110, 230))
    d = ImageDraw.Draw(img)
    y = text_block(d, (80, 420), ['Create', 'Without', 'Limits'], font(128, True), (255, 255, 255), 1.06)
    text_block(d, (80, y + 40), ['All-in-one content studio', 'for modern teams.'], font(44), (190, 205, 235))
    return img

def future_marketing(size=(1200, 800)):
    img = gradient(size, (8, 20, 60), (18, 48, 120), -20)
    glow_lines(img, (60, 140, 255))
    d = ImageDraw.Draw(img)
    text_block(d, (70, 120), ['Future of', 'Digital Marketing', 'in 2026'], font(92, True), (255, 255, 255), 1.1)
    return img

def template_cover(kind, size=(900, 760)):
    w, h = size
    if kind == 'grow':
        img = gradient(size, (3, 8, 24), (10, 22, 60), -70)
        glow_lines(img, (70, 120, 255))
        d = ImageDraw.Draw(img)
        d.text((56, 60), 'CAPTION FOX STUDIO', font=font(22, True), fill=(170, 185, 220))
        text_block(d, (56, 110), ['Grow Your Brand', 'With Caption Fox'], font(78, True), (255, 255, 255), 1.1)
        fox(img, (56, h - 230, 120))
    elif kind == 'feature':
        img = gradient(size, (240, 200, 245), (150, 150, 250), -35)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((56, 70, 150, 110), 10, fill=(255, 255, 255))
        d.text((72, 76), 'NEW', font=font(24, True), fill=(90, 60, 180))
        text_block(d, (56, 150), ['New Feature', 'Now Live'], font(86, True), (40, 30, 90), 1.08)
        d.polygon([(w * 0.55, h), (w, h * 0.45), (w, h)], fill=(255, 235, 250))
    elif kind == 'success':
        img = gradient(size, (18, 70, 230), (40, 110, 255), -30)
        d = ImageDraw.Draw(img)
        text_block(d, (56, 60), ['Customer', 'Success Story'], font(78, True), (255, 255, 255), 1.08)
        d.rounded_rectangle((56, 330, w - 120, 560), 22, fill=(255, 255, 255))
        d.text((90, 360), '\u201c', font=font(90, True), fill=(30, 90, 240))
        text_block(d, (160, 380), ['Caption Fox has transformed', 'our content workflow.'], font(34), (40, 50, 80), 1.3)
        d.text((160, 480), '\u2014 Alex Morgan, Marketing Lead', font=font(26), fill=(120, 130, 150))
    else:
        img = gradient(size, (4, 8, 22), (14, 20, 48), -70)
        glow_lines(img, (80, 90, 255))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((56, 60, 230, 104), 8, outline=(200, 205, 230), width=2)
        d.text((74, 68), 'WEBINAR', font=font(24, True), fill=(230, 235, 250))
        text_block(d, (56, 140), ['Master Social', 'Media Strategy'], font(80, True), (255, 255, 255), 1.08)
        d.text((56, 350), '10 Oct 2026 \u2022 2:00 PM BST', font=font(32), fill=(210, 215, 235))
        d.text((56, 420), 'Save your spot today!', font=font(34, True), fill=(255, 255, 255))
    return img

def blue_waves(size=(1200, 1200)):
    img = gradient(size, (4, 16, 60), (12, 50, 140), -45)
    glow_lines(img, (90, 170, 255))
    return img.filter(ImageFilter.GaussianBlur(1.5))

def document_cover(title, subtitle, c1, c2, size=(1200, 900)):
    img = gradient(size, c1, c2, -30)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, size[0], 90), fill=(255, 255, 255))
    d.text((40, 26), subtitle.upper(), font=font(30, True), fill=(60, 70, 100))
    text_block(d, (60, 260), title.split('|'), font(84, True), (255, 255, 255), 1.1)
    return img

def logo_tile(size=(1000, 1000)):
    img = gradient(size, (0, 150, 255), (0, 110, 230), -30)
    fox(img, (250, 250, 500))
    return img

def ui_kit(size=(1000, 1000)):
    img = Image.new('RGB', size, (246, 247, 250))
    d = ImageDraw.Draw(img)
    d.polygon([(300, 250), (700, 250), (820, 470), (500, 820), (180, 470)], fill=(255, 196, 40))
    d.polygon([(300, 250), (500, 470), (180, 470)], fill=(255, 160, 20))
    d.polygon([(700, 250), (820, 470), (500, 470)], fill=(255, 130, 30))
    d.polygon([(180, 470), (500, 470), (500, 820)], fill=(245, 110, 20))
    return img

def fallback(title, c1=(25, 45, 90), c2=(60, 110, 200), size=(1600, 1000)):
    img = gradient(size, c1, c2)
    d = ImageDraw.Draw(img)
    f = font(size[1] // 10, True)
    d.text((size[0] // 2 - d.textlength(title, font=f) / 2, size[1] // 2 - f.size / 2), title, font=f, fill=(255, 255, 255))
    return img

# ── Asset list ───────────────────────────────────────────────────────────────
# (file name, source, output size, mime)
PHOTOS = {
    'Mountain Landscape.jpg': ('1464822759023-fed622ff2c3b', (1920, 1290)),
    'Summit Hero.jpg': ('1506905925346-21bda4d32df4', (1920, 1280)),
    'Workspace Desk.jpg': ('1498050108023-c5249f4df085', (1600, 1600)),
    'Remote Work Session.jpg': ('1573497019940-1c28c88b4f3e', (1600, 1600)),
    'Studio Chair.jpg': ('1598300042247-d088f8ab3a91', (1600, 1600)),
    'Monstera Still Life.jpg': ('1485955900006-10f4d324d411', (1600, 1600)),
    'Team Photo.jpg': ('1522071820081-009f0129c71c', (1920, 1280)),
    'Hydrating Serum.jpg': ('1608571423902-eed4a5ad8108', (1600, 1200)),
    'Skincare Routine.jpg': ('1620916566398-39f1143ab7be', (1600, 1200)),
    'Creator Portrait.jpg': ('1517841905240-472988babdf9', (1600, 1200)),
    'Office Corridor.jpg': ('1497366754035-f200968a6e72', (1600, 1200)),
    'Analytics Dashboard.jpg': ('1551288049-bebda4e38f71', (1600, 1200)),
    'Strategy Meeting.jpg': ('1552664730-d307ca884978', (1600, 1200)),
    'Planning Workshop.jpg': ('1600880292203-757bb62b4baf', (1600, 1200)),
    'Product Demo Still.jpg': ('1542744173-8e7e53415bb0', (1920, 1080)),
    'Customer Story Still.jpg': ('1573497019940-1c28c88b4f3e', (1920, 1080)),
}

DESIGNED = {
    'Create Without Limits.png': create_without_limits,
    'Future of Digital Marketing.png': future_marketing,
    'Template Grow Your Brand.png': lambda: template_cover('grow'),
    'Template New Feature.png': lambda: template_cover('feature'),
    'Template Customer Success.png': lambda: template_cover('success'),
    'Template Webinar.png': lambda: template_cover('webinar'),
    'Blue Waves Background.png': blue_waves,
    'Brand Guidelines Cover.png': lambda: document_cover('Brand|Guidelines', 'Caption Fox', (30, 60, 200), (80, 120, 255)),
    'Onboarding Guide Cover.png': lambda: document_cover('Onboarding|Guide', 'Presentation', (70, 40, 110), (150, 90, 170)),
    'Logo White.png': logo_tile,
    'UI Kit.png': ui_kit,
}

manifest = {}
random.seed(7)
for name, (pid, size) in PHOTOS.items():
    try:
        img = cover(fetch(pid), size)
        source = 'unsplash'
    except Exception as exc:  # noqa: BLE001 — offline fallback is the point
        print('  fallback', name, exc)
        img = fallback(name.rsplit('.', 1)[0], size=size)
        source = 'designed'
    slug = name.lower().replace(' ', '-').replace('.jpg', '')
    img.save(os.path.join(OUT, 'originals', f'{slug}.jpg'), quality=88)
    thumb = cover(img, (560, 420) if size[0] > size[1] else (480, 480))
    thumb.save(os.path.join(OUT, 'thumbs', f'{slug}.jpg'), quality=82)
    manifest[name] = {'original': f'originals/{slug}.jpg', 'thumb': f'thumbs/{slug}.jpg', 'mime': 'image/jpeg',
                      'width': size[0], 'height': size[1], 'source': source}
    print('  ok', name)

for name, render in DESIGNED.items():
    img = render().convert('RGB')
    slug = name.lower().replace(' ', '-').replace('.png', '')
    img.save(os.path.join(OUT, 'originals', f'{slug}.png'))
    thumb = img.copy()
    thumb.thumbnail((640, 640))
    thumb.save(os.path.join(OUT, 'thumbs', f'{slug}.jpg'), quality=86)
    manifest[name] = {'original': f'originals/{slug}.png', 'thumb': f'thumbs/{slug}.jpg', 'mime': 'image/png',
                      'width': img.width, 'height': img.height, 'source': 'designed'}
    print('  ok', name)

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8') as fh:
    json.dump(manifest, fh, indent=2)
print('done', len(manifest))
