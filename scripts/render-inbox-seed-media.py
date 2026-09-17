"""Renders the Inbox + Fox AI Copilot demo media into supabase/seed-media/inbox/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required, no Unsplash+ premium ids). Creative outputs are composed
locally (photo + bold type) so the Media tab's demo jobs have real image files.

  python scripts/render-inbox-seed-media.py
  node scripts/seed-inbox-demo.mjs <workspaceId>

Outputs:
  avatars/<slug>.jpg        320x320 contact portraits
  outputs/<slug>.jpg        800x1000 generated-creative demo outputs
  jobs/<slug>.jpg           160x160 job thumbnails
  files/Welcome_Series_Timeline.xlsx, files/Welcome_Email_V3.html
  contact-sheet.jpg         visual check of every portrait
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join('supabase', 'seed-media', 'inbox')
for sub in ('avatars', 'outputs', 'jobs', 'files'):
    os.makedirs(os.path.join(ROOT, sub), exist_ok=True)

_cache = {}


def photo(pid, w=900):
    if pid in _cache:
        return _cache[pid].copy()
    url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=90&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
    try:
        data = urllib.request.urlopen(req, timeout=60).read()
    except Exception as exc:  # noqa: BLE001
        print('  ! unavailable', pid, exc)
        return None
    im = Image.open(io.BytesIO(data)).convert('RGB')
    _cache[pid] = im
    return im.copy()


def cover(im, size, focus_y=0.4):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = int(max(0, min(im.height - th, (im.height - th) * focus_y)))
    return im.crop((left, top, left + tw, top + th))


PORTRAITS = {
    'jane-cooper': '1531123897727-8f129e1688ce',
    'robert-fox': '1506794778202-cad84cf45f1d',
    'marvin-mckinney': '1539571696357-5a69c17a67c6',
    'cody-fisher': '1552058544-f2b08422138a',
    'darrell-steward': '1560250097-0b93528c311a',
    'dianne-russell': '1580489944761-15a19d654956',
    'theresa-webb': '1573496359142-b8d87734a5a2',
    'alex-morgan': '1524504388940-b1c1722653e1',
    'james-wilson': '1633332755192-727a05c4013d',
    'olivia-brown': '1529626455594-4ff0802cfb7e',
    'benjamin-lee': '1527980965255-d3b416303d12',
    'isabella-garcia': '1488426862026-3ee34a7d66df',
    'ethan-johnson': '1552374196-c4e7ffc6e126',
    'olivia-kim': '1567532939604-b6b5b0db2604',
    'michael-brown': '1545167622-3a6ac756afa4',
    'james-thompson': '1500648767791-00dcc994a43e',
    'matthew-taylor': '1507591064344-4c6ce005b128',
    'ethan-brown': '1519345182560-3f2917c472ef',
    'emma-davis': '1438761681033-6461ffad8d80',
    'liam-chen': '1507003211169-0a1dd7228f2d',
    'sophia-patel': '1534528741775-53994a69daeb',
    'noah-williams': '1522075469751-3a6694fb2f61',
    'ava-martinez': '1544005313-94ddf0286df2',
}

manifest = {'avatars': {}, 'outputs': {}, 'jobs': {}, 'files': {}}
sheet = []
for slug, pid in PORTRAITS.items():
    im = photo(pid, 640)
    if im is None:
        continue
    face = cover(im, (320, 320), 0.25)
    face.save(os.path.join(ROOT, 'avatars', f'{slug}.jpg'), quality=88)
    manifest['avatars'][slug] = f'avatars/{slug}.jpg'
    sheet.append((slug, face.resize((120, 120))))
    print('avatar', slug)

cols = 8
rows = (len(sheet) + cols - 1) // cols
cs = Image.new('RGB', (cols * 130, rows * 145), 'white')
d = ImageDraw.Draw(cs)
for i, (slug, im) in enumerate(sheet):
    x, y = (i % cols) * 130 + 5, (i // cols) * 145 + 5
    cs.paste(im, (x, y))
    d.text((x, y + 122), slug[:18], fill='black')
cs.save(os.path.join(ROOT, 'contact-sheet.jpg'), quality=85)


def font(size, bold=True):
    for name in (('arialbd.ttf', 'Arial Bold') if bold else ('arial.ttf',)):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    for path in ('C:/Windows/Fonts/impact.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def impact(size):
    p = 'C:/Windows/Fonts/impact.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else font(size)


SCRUB = {'launch-mode': [(385, 400, 505, 485)], 'lighter-faster-louder': []}

# Sneaker product shots (no visible third-party logos on the chosen crops).
OUTPUTS = [
    ('next-drop', '1604671801908-6f0c6a092c05', ['NEXT', 'DROP'], (10, 30, 90), (255, 255, 255), '05.24.24'),
    ('built-to-move', '1560769629-975ec94e6a86', ['BUILT', 'TO', 'MOVE'], (90, 20, 60), (255, 225, 235), 'New Sneaker Drop 05.24.24'),
    ('lighter-faster-louder', '1587563871167-1ee9c731aefb', ['LIGHTER.', 'FASTER.', 'LOUDER.'], (235, 240, 248), (29, 78, 216), '05.24.24 New Sneaker Drop'),
    ('launch-mode', '1491553895911-0055eca6402d', ['LAUNCH', 'MODE'], (8, 12, 30), (255, 255, 255), '05.24.24 NEW SNEAKER DROP'),
]

for slug, pid, lines, tint, ink, foot in OUTPUTS:
    base = photo(pid, 1200)
    if base is None:
        base = Image.new('RGB', (800, 1000), tint)
    if slug == 'lighter-faster-louder':
        base = base.crop((0, 0, int(base.width * 0.62), base.height))
    im = cover(base, (800, 1000), 0.55)
    # Scrub any maker's mark so demo creatives carry no third-party branding.
    for box in SCRUB.get(slug, []):
        from PIL import ImageStat
        median = tuple(int(v) for v in ImageStat.Stat(im.crop(box)).median)
        region = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), median)
        mask = Image.new('L', region.size, 0)
        ImageDraw.Draw(mask).ellipse((8, 8, region.width - 8, region.height - 8), fill=255)
        im.paste(region, box[:2], mask.filter(ImageFilter.GaussianBlur(10)))
    overlay = Image.new('RGB', im.size, tint)
    im = Image.blend(im, overlay, 0.28)
    grad = Image.new('L', (1, 1000))
    for y in range(1000):
        grad.putpixel((0, y), int(max(0, 200 - y * 0.5)))
    im.paste(Image.new('RGB', im.size, tint), (0, 0), grad.resize(im.size))
    d = ImageDraw.Draw(im)
    f = impact(150 if len(lines) < 3 else 118)
    y = 50
    for line in lines:
        d.text((50, y), line, font=f, fill=ink)
        y += f.size + 4
    d.text((50, 930), foot, font=font(34), fill=ink)
    im.save(os.path.join(ROOT, 'outputs', f'{slug}.jpg'), quality=88)
    manifest['outputs'][slug] = f'outputs/{slug}.jpg'
    print('output', slug)

JOBS = {
    'sneaker-launch-visual': 'outputs/next-drop.jpg',
    'minimal-product-banner': 'outputs/lighter-faster-louder.jpg',
    'reel-cover-options': 'outputs/built-to-move.jpg',
    'brand-moodboard': 'outputs/launch-mode.jpg',
    'ad-creative-set': 'outputs/built-to-move.jpg',
}
for slug, src in JOBS.items():
    im = Image.open(os.path.join(ROOT, src)).convert('RGB')
    cover(im, (160, 160), 0.6).save(os.path.join(ROOT, 'jobs', f'{slug}.jpg'), quality=85)
    manifest['jobs'][slug] = f'jobs/{slug}.jpg'

try:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Timeline'
    ws.append(['Milestone', 'Channel', 'Owner', 'Date', 'Status'])
    for row in [
        ('Copy final', 'Email', 'Sophia Patel', '2024-05-10', 'Done'),
        ('Segments reviewed', 'SMS / Push', 'Ava Martinez', '2024-05-13', 'In review'),
        ('QA send', 'Email', 'Liam Chen', '2024-05-15', 'Scheduled'),
        ('First send', 'Email, SMS, WhatsApp, Push', 'Emma Davis', '2024-05-16', 'Scheduled'),
    ]:
        ws.append(row)
    wb.save(os.path.join(ROOT, 'files', 'Welcome_Series_Timeline.xlsx'))
    manifest['files']['timeline'] = 'files/Welcome_Series_Timeline.xlsx'
except ImportError:
    pass

with open(os.path.join(ROOT, 'files', 'Welcome_Email_V3.html'), 'w', encoding='utf-8') as fh:
    fh.write('<!doctype html><html><body style="font-family:Arial;padding:24px">'
             '<h1>Welcome aboard</h1><p>Thanks for signing up. Here is everything you need to get '
             'started in your first week.</p><p><a href="#">Set up your account</a></p></body></html>')
manifest['files']['email'] = 'files/Welcome_Email_V3.html'

with open(os.path.join(ROOT, 'manifest.json'), 'w') as fh:
    json.dump(manifest, fh, indent=2)
print('done')
