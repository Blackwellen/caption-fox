"""Render the Brand & Assets demo media into supabase/seed-media/brand-assets/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required). Designed covers (brand guide, decks, social posts,
logos) are rendered here with real text so they stay sharp at any card size.

Output:
  thumbs/<slug>.jpg      640x480 card thumbnails (products 640x640)
  originals/<slug>.<ext> the downloadable original where one can exist (jpg/png/pdf)
  avatars/<slug>.jpg     320x320 demo teammate portraits
  manifest.json          file_name -> {thumb, original, mime}

Run: python scripts/render-brand-seed-media.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'seed-media', 'brand-assets')
for sub in ('thumbs', 'originals', 'avatars'):
    os.makedirs(os.path.join(ROOT, sub), exist_ok=True)

FONT_DIR = 'C:/Windows/Fonts'
def font(size, bold=False):
    for name in (('segoeuib.ttf', 'arialbd.ttf') if bold else ('segoeui.ttf', 'arial.ttf')):
        p = os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

_cache = {}
def photo(pid, w=1600):
    key = (pid, w)
    if key not in _cache:
        url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=90&fm=jpg'
        req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
        _cache[key] = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGB')
    return _cache[key].copy()

def cover(im, size):
    """Centre-crop to fill `size` exactly (no letterboxing, no stretching)."""
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    l, t = (im.width - tw) // 2, (im.height - th) // 2
    return im.crop((l, t, l + tw, t + th))

def save(im, path, fmt='JPEG'):
    im.save(path, fmt, **({'quality': 88, 'optimize': True, 'progressive': True} if fmt == 'JPEG' else {}))

# ---------------------------------------------------------------------------
# Unsplash photo ids, chosen and checked visually against the references.
P = {
    'serum': '1608571423902-eed4a5ad8108', 'jars': '1611930022073-b7a4ba5fcccd',
    'cream': '1620916566398-39f1143ab7be', 'tube': '1556228578-8c89e6adf883',
    'shoe_white': '1600185365483-26d7a4cc7519', 'shoe_black': '1491553895911-0055eca6402d',
    'headphones': '1583394838336-acd977736f90', 'headphones_yellow': '1505740420928-5e560c06d30e',
    'coffee': '1559056199-641a0ac8b55e', 'bag': '1590874103328-eac38a683ce7',
    'box': '1698376621004-70ce754157d1', 'flatlay': '1612817288484-6f916006741a',
    'makeup': '1596462502278-27bfdc403348', 'outdoor': '1553531384-cc64ac80f931',
    'chair': '1598300042247-d088f8ab3a91', 'woman_blue': '1531746020798-e6953c6e8e04',
    'backpack': '1622560480605-d83c853bc5c3',
    # Pass 3: closer to the references' blue Acme palette and subjects.
    'serum_blue': '1676809180101-1f215d615829', 'serum_dark': '1764694187721-a5035d777fdf',
    'shoe_blue': '1637437757614-6491c8e915b5', 'tote_dark': '1572196284554-4e321b0e7e0b',
    'protein_bar': '1633360821154-1935fb5671e6', 'headphones_navy': '1566478989151-541ffa519573',
}

BLUE, NAVY, WHITE = (37, 99, 235), (15, 23, 42), (255, 255, 255)

def designed(title, sub, bg=BLUE, accent_photo=None, label=None, size=(1280, 960)):
    """A branded cover: gradient, headline, optional product cut-in."""
    w, h = size
    im = Image.new('RGB', size, bg)
    grad = Image.linear_gradient('L').resize(size).rotate(35, expand=False)
    im = Image.composite(Image.new('RGB', size, NAVY), im, grad.point(lambda v: int(v * 0.55)))
    d = ImageDraw.Draw(im)
    if accent_photo:
        ph = cover(photo(P[accent_photo]), (int(w * 0.42), int(h * 0.78)))
        mask = Image.new('L', ph.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, *ph.size), 36, fill=255)
        im.paste(ph, (int(w * 0.52), int(h * 0.11)), mask)
    d.text((int(w * 0.07), int(h * 0.30)), title, font=font(int(h * 0.085), True), fill=WHITE, spacing=10)
    d.text((int(w * 0.07), int(h * 0.30) + int(h * 0.26)), sub, font=font(int(h * 0.04)), fill=(219, 234, 254))
    if label:
        d.rounded_rectangle((int(w * 0.07), int(h * 0.12), int(w * 0.07) + int(w * 0.2), int(h * 0.12) + int(h * 0.07)), 14, fill=WHITE)
        d.text((int(w * 0.085), int(h * 0.128)), label, font=font(int(h * 0.036), True), fill=BLUE)
    return im

def document(title, sub, tint=(239, 246, 255), size=(1280, 960)):
    """A document page mock: white sheet with heading and ruled content lines."""
    im = Image.new('RGB', size, tint)
    d = ImageDraw.Draw(im)
    w, h = size
    sheet = (int(w * 0.2), int(h * 0.08), int(w * 0.8), int(h * 1.05))
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((sheet[0] + 10, sheet[1] + 16, sheet[2] + 10, sheet[3]), 18, fill=(15, 23, 42, 60))
    im.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
    d.rounded_rectangle(sheet, 18, fill=WHITE)
    x = sheet[0] + 60
    d.rectangle((x, sheet[1] + 60, x + 120, sheet[1] + 76), fill=BLUE)
    d.text((x, sheet[1] + 100), title, font=font(58, True), fill=NAVY)
    d.text((x, sheet[1] + 180), sub, font=font(30), fill=(100, 116, 139))
    y = sheet[1] + 260
    for i in range(12):
        d.rounded_rectangle((x, y, sheet[2] - 60 - (i % 3) * 90, y + 14), 7, fill=(226, 232, 240))
        y += 44
    return im

def logo(text, colour, bg=WHITE, size=(1280, 960)):
    im = Image.new('RGB', size, bg)
    d = ImageDraw.Draw(im)
    f = font(210, True)
    tw = d.textlength(text, font=f)
    d.text(((size[0] - tw) / 2, size[1] / 2 - 130), text, font=f, fill=colour)
    return im

# ---------------------------------------------------------------------------
# Assets: file_name -> (thumbnail image, original kind)
ASSETS = {
    'Acme Hydrate Serum.jpg':      (lambda: photo(P['serum_blue']), 'jpg'),
    'Product Launch.mp4':          (lambda: photo(P['serum_dark']), None),
    'Acme_Brand_Guide.pdf':        (lambda: designed('Acme\nBrand Guidelines', 'Identity system  ·  v3.2', label='ACME'), 'pdf'),
    'Pitch_Deck_Template.pptx':    (lambda: designed('Presentation\nTemplate', 'Acme Global  ·  16:9', label='DECK'), None),
    'Acme Package Box.psd':        (lambda: photo(P['box']), None),
    'Acme_new_post.png':           (lambda: designed('New\nCollection', 'Out now  ·  Acme Care', accent_photo='serum_blue', label='NEW'), 'png'),
    'Acme Runner Pro.jpg':         (lambda: photo(P['shoe_blue']), 'jpg'),
    'Cleanser Ad_30sec.mp4':       (lambda: photo(P['woman_blue']), None),
    'Acme Campaign Brief.pdf':     (lambda: document('Campaign Brief', 'Acme Care  ·  Spring 2026'), 'pdf'),
    'Protein Bars_Group.jpg':      (lambda: photo(P['protein_bar']), 'jpg'),
    'Acme Summer Campaign.jpg':    (lambda: photo(P['makeup']), 'jpg'),
    'Behind the Scenes.mp4':       (lambda: photo(P['chair']), None),
    'Product Spec Sheet.pdf':      (lambda: document('Product Spec Sheet', 'Acme Foods  ·  ACM-3002'), 'pdf'),
    'Event Banner Template.pptx':  (lambda: designed('Event\nBanner', 'Acme Global  ·  1920×600', label='TEMPLATE'), None),
    'Acme Packaging Mockup.psd':   (lambda: photo(P['jars']), None),
    'Old Logo (Black).png':        (lambda: logo('ACME', NAVY), 'png'),
    'Expired License.mp4':         (lambda: photo(P['outdoor']), None),
    'Spring Campaign_v1.jpg':      (lambda: photo(P['tube']), 'jpg'),
    'Draft_Layout.psd':            (lambda: document('Draft Layout', 'Acme  ·  Work in progress', tint=(248, 250, 252)), None),
    'Event Post_old.png':          (lambda: designed('Race\nDay', 'Acme Sport  ·  Archive', accent_photo='shoe_black', bg=(22, 163, 74)), 'png'),
}

PRODUCTS = {  # sku -> photo
    'ACM-1001': 'serum_blue', 'ACM-1001-EU': 'serum', 'ACM-1003': 'cream', 'ACM-2005': 'shoe_blue',
    'ACM-2011': 'shoe_black', 'ACM-3002': 'protein_bar', 'ACM-4007': 'headphones_navy',
    'ACM-5003': 'tote_dark', 'ACM-6001': 'coffee', 'ACM-6004': 'jars', 'ACM-9002': 'outdoor',
    'ACM-4009': 'backpack',
}

AVATARS = {
    'emily-johnson': '1438761681033-6461ffad8d80', 'michael-chen': '1507003211169-0a1dd7228f2d',
    'sarah-williams': '1494790108377-be9c29b29330', 'david-martinez': '1500648767791-00dcc994a43e',
    'jason-ranti': '1472099645785-5658abf4ff4e', 'priya-shah': '1534528741775-53994a69daeb',
    'grace-kim': '1544005313-94ddf0286df2',
}

def slug(s):
    return ''.join(c.lower() if c.isalnum() else '-' for c in s).strip('-').replace('--', '-')

manifest = {'assets': {}, 'products': {}, 'avatars': {}}

for fname, (make, orig_kind) in ASSETS.items():
    s = slug(os.path.splitext(fname)[0])
    im = make()
    save(cover(im, (640, 480)), os.path.join(ROOT, 'thumbs', f'{s}.jpg'))
    entry = {'thumb': f'thumbs/{s}.jpg', 'original': None, 'mime': None}
    if orig_kind == 'jpg':
        save(cover(im, (1600, 1200)) if im.width >= 1600 else im, os.path.join(ROOT, 'originals', f'{s}.jpg'))
        entry.update(original=f'originals/{s}.jpg', mime='image/jpeg')
    elif orig_kind == 'png':
        im.save(os.path.join(ROOT, 'originals', f'{s}.png'), 'PNG', optimize=True)
        entry.update(original=f'originals/{s}.png', mime='image/png')
    elif orig_kind == 'pdf':
        pages = [im.convert('RGB'), document('Contents', fname.replace('_', ' ').rsplit('.', 1)[0]).convert('RGB')]
        pages[0].save(os.path.join(ROOT, 'originals', f'{s}.pdf'), 'PDF', save_all=True, append_images=pages[1:], resolution=150)
        entry.update(original=f'originals/{s}.pdf', mime='application/pdf')
    manifest['assets'][fname] = entry
    print('asset', fname)

for sku, key in PRODUCTS.items():
    s = slug(sku)
    im = photo(P[key])
    save(cover(im, (640, 640)), os.path.join(ROOT, 'thumbs', f'product-{s}.jpg'))
    save(cover(im, (1600, 1600)), os.path.join(ROOT, 'originals', f'product-{s}.jpg'))
    manifest['products'][sku] = {'thumb': f'thumbs/product-{s}.jpg', 'original': f'originals/product-{s}.jpg', 'mime': 'image/jpeg'}
    print('product', sku)

for person, pid in AVATARS.items():
    im = photo(pid, 800)
    # Faces sit in the upper third of these portraits; bias the crop upward.
    side = min(im.width, im.height)
    top = max(0, int(im.height * 0.08)) if im.height > im.width else 0
    im = im.crop(((im.width - side) // 2, top, (im.width - side) // 2 + side, top + side)).resize((320, 320), Image.LANCZOS)
    save(im, os.path.join(ROOT, 'avatars', f'{person}.jpg'))
    manifest['avatars'][person] = f'avatars/{person}.jpg'
    print('avatar', person)

# ---------------------------------------------------------------------------
# Brand wordmarks — transparent PNGs rendered at 3x the card size so they stay
# crisp on high-density screens. Each has its own mark, like the references.
os.makedirs(os.path.join(ROOT, 'logos'), exist_ok=True)
manifest['logos'] = {}

def wordmark(slug_, word, sub, colour, mark=None, italic=False):
    W, H = 720, 240
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 20
    if mark:
        cx, cy, r = 20 + 80, H // 2, 78
        if mark == 'heart':
            import math
            # Parametric heart curve, stroked — a single continuous outline.
            pts = []
            for i in range(0, 361, 3):
                t = math.radians(i)
                x_ = 16 * math.sin(t) ** 3
                y_ = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
                pts.append((cx + x_ * r / 16.5, cy - 8 - y_ * r / 16.5))
            d.line(pts + [pts[0]], fill=colour, width=20, joint='curve')
        elif mark == 'diamond':
            d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=colour)
            d.polygon([(cx, cy - r + 40), (cx + r - 40, cy), (cx, cy + r - 40), (cx - r + 40, cy)], fill=(255, 255, 255, 255))
        elif mark == 'ring':
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour)
            d.pieslice((cx - r + 30, cy - r + 30, cx + r - 30, cy + r - 30), 200, 20, fill=(255, 255, 255, 255))
        elif mark == 'book':
            d.rounded_rectangle((cx - r, cy - r + 20, cx - 6, cy + r - 10), 10, fill=colour)
            d.rounded_rectangle((cx + 6, cy - r + 20, cx + r, cy + r - 10), 10, fill=colour)
            d.rectangle((cx - 4, cy - r + 10, cx + 4, cy + r), fill=colour)
        x = 20 + 180
    fbig = font(118 if not sub else 104, True)
    d.text((x, 20 if sub else 50), word, font=fbig, fill=colour)
    if sub:
        # Sub-word centred under the main word and tracked out, as on the references.
        fsub = font(58, True)
        wmain = d.textlength(word, font=fbig)
        spaced = ' '.join(sub) if len(sub) <= 5 else sub
        wsub = d.textlength(spaced, font=fsub)
        d.text((x + max(0, (wmain - wsub) / 2), 146), spaced, font=fsub, fill=colour)
    if italic:
        im = im.transform(im.size, Image.AFFINE, (1, 0.22, -30, 0, 1, 0), Image.BICUBIC)
    bbox = im.getbbox()
    im = im.crop(bbox) if bbox else im
    im.save(os.path.join(ROOT, 'logos', f'{slug_}.png'), 'PNG', optimize=True)
    manifest['logos'][slug_] = f'logos/{slug_}.png'
    print('logo', slug_)

wordmark('acme', 'ACME', None, (17, 24, 39, 255), italic=True)
wordmark('acme-sport', 'ACME', 'SPORT', (17, 24, 39, 255))
wordmark('acme-care', 'ACME', 'CARE', (37, 99, 235, 255), mark='heart')
wordmark('acme-foods', 'ACME', 'FOODS', (220, 38, 38, 255))
wordmark('acme-tech', 'ACME', 'TECH', (29, 78, 216, 255), mark='diamond')
wordmark('acme-finance', 'ACME', 'FINANCE', (5, 150, 105, 255), mark='ring')
wordmark('acme-education', 'ACME', 'EDUCATION', (37, 99, 235, 255), mark='book')

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
print('done')
