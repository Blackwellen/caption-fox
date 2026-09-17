"""Render the Marketplace demo profile media into public/demo/marketplace/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required, no Unsplash+ premium photos). Any photo that cannot be
fetched falls back to a designed gradient rendered here, so seeding never
depends on network luck. Output is deterministic and clearly demo-only.

Each supplier gets a 16:9 cover and a square avatar crop of the same source,
so a card, a table row and an avatar stack all show the same identity.

Run: python scripts/render-marketplace-seed-media.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo', 'marketplace')
os.makedirs(os.path.join(OUT, 'covers'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'avatars'), exist_ok=True)

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


def crop_to(im, size, top_bias=False):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - tw) // 2
    # Portraits crop from just below the top edge: a hard top crop slices the
    # forehead off on a 16:9 cover, a centre crop cuts the face in half.
    y = round((im.height - th) * 0.12) if top_bias else (im.height - th) // 2
    return im.crop((x, y, x + tw, y + th))


GRADIENTS = [((37, 99, 235), (30, 64, 175)), ((124, 58, 237), (76, 29, 149)),
             ((8, 145, 178), (14, 116, 144)), ((5, 150, 105), (6, 95, 70)),
             ((219, 39, 119), (157, 23, 77)), ((234, 88, 12), (154, 52, 18))]


def designed(title, size, seed):
    """Fallback: the same deterministic brand gradient the UI uses, titled."""
    w, h = size
    c1, c2 = GRADIENTS[sum(ord(c) for c in seed) % len(GRADIENTS)]
    base, top = Image.new('RGB', (w, h), c1), Image.new('RGB', (w, h), c2)
    mask = Image.linear_gradient('L').rotate(-25, expand=False).resize((w, h))
    base = Image.composite(top, base, mask).filter(ImageFilter.GaussianBlur(0))
    d = ImageDraw.Draw(base)
    f = font(max(16, h // 9), bold=True)
    words, lines, cur = title.upper().split(), [], ''
    for word in words:
        t = (cur + ' ' + word).strip()
        if d.textlength(t, font=f) > w - 40 and cur:
            lines.append(cur)
            cur = word
        else:
            cur = t
    lines.append(cur)
    y = h // 2 - len(lines) * (f.size + 6) // 2
    for line in lines:
        d.text(((w - d.textlength(line, font=f)) / 2, y), line, font=f, fill=(255, 255, 255))
        y += f.size + 6
    return base


# slug -> (unsplash id, display name). People get portraits, studios get
# workspace photography, so card identity reads correctly at a glance.
PEOPLE = {
    'sarah-fitlife':    ('1518611012118-696072aa579a', 'Sarah FitLife'),
    'mike-moves':       ('1517838277536-f5f99be501cd', 'Mike Moves'),
    'glow-with-allie':  ('1487412720507-e7ab37603c6f', 'Glow With Allie'),
    'tech-with-tony':   ('1507003211169-0a1dd7228f2d', 'Tech With Tony'),
    'wander-with-jen':  ('1502685104226-ee32379fefbe', 'Wander With Jen'),
    'chef-marley':      ('1577219491135-ce391730fb2c', 'Chef Marley'),
    'priya-k':          ('1524504388940-b1c1722653e1', 'Priya K'),
    'taylor-morgan':    ('1494790108377-be9c29b29330', 'Taylor Morgan'),
    'chris-bennett':    ('1500648767791-00dcc994a43e', 'Chris Bennett'),
    'sofia-ramirez':    ('1534528741775-53994a69daeb', 'Sofia Ramirez'),
    'sophia-lee':       ('1517841905240-472988babdf9', 'Sophia Lee'),
    'marcus-brown':     ('1506794778202-cad84cf45f1d', 'Marcus Brown'),
    'lena-rodriguez':   ('1554151228-14d9def656e4', 'Lena Rodriguez'),
    'ethan-park':       ('1508214751196-bcfd4ca60f91', 'Ethan Park'),
    'mara-lewis':       ('1544005313-94ddf0286df2', 'Mara Lewis'),
    'sam-okafor':       ('1531123897727-8f129e1688ce', 'Sam Okafor'),
    'theo-brandt':      ('1519085360753-af0119f7cbe7', 'Theo Brandt'),
    'voicepro-studios': ('1598488035139-bdbb2231ce04', 'VoicePro Studios'),
    'audio-masters':    ('1511379938547-c1f69419868d', 'Audio Masters'),
    'audiowave-studios': ('1590602847861-f357a9332bbc', 'AudioWave Studios'),
    'logo-design-co':   ('1626785774573-4b799315345d', 'Logo Design Co.'),
    'video-editors-pro': ('1492691527719-9d1e07e534b4', 'Video Editors Pro'),
}

STUDIOS = {
    'motioncraft-studio': ('1540575467063-178a50c2df87', 'MotionCraft Studio'),
    'pixel-perfect-designs': ('1497366216548-37526070297c', 'Pixel Perfect Designs'),
    'creative-writers-hub': ('1455390582262-044cdead277a', 'Creative Writers Hub'),
    'design-fusion':      ('1559028012-481c04fa702d', 'Design Fusion'),
    'seo-content-pros':   ('1460925895917-afdab827c52f', 'SEO Content Pros'),
    'ugc-pros':           ('1596704017254-9b121068fb31', 'UGC Pros'),
    'animax-studio':      ('1618004652321-13a63e576b80', 'Animax Studio'),
    'elite-video-studio': ('1579389083078-4e7018379f7e', 'Elite Video Studio'),
    'northstar-agency':   ('1522071820081-009f0129c71c', 'Northstar Agency'),
    'studio-verde':       ('1497366754035-f200968a6e72', 'Studio Verde'),
    'luna-creative-co-9b50fd': ('1524758631624-e2822e304c36', 'Luna Creative Co.'),
    'jamahl-thomas-creative-studio': ('1600880292203-757bb62b4baf', 'Jamahl Thomas Creative Studio'),
    'growth-lab':         ('1551288049-bebda4e38f71', 'Growth Lab'),
    'linkedin-growth':    ('1611944212129-29977ae1398c', 'LinkedIn Growth'),
    'pixelpilot':         ('1533750516457-a7f992034fec', 'PixelPilot'),
}

manifest = {}
ok = 0
for group, top_bias in ((PEOPLE, True), (STUDIOS, False)):
    for slug, (pid, title) in group.items():
        try:
            src_im = fetch(pid)
            src = 'unsplash'
            ok += 1
        except Exception as exc:                      # offline, 404, rate limit
            src_im = None
            src = f'designed ({type(exc).__name__})'
        cov = crop_to(src_im, (640, 360), top_bias) if src_im else designed(title, (640, 360), slug)
        avt = crop_to(src_im, (256, 256), top_bias) if src_im else designed(title, (256, 256), slug)
        cov.save(os.path.join(OUT, 'covers', f'{slug}.jpg'), 'JPEG', quality=84, optimize=True)
        avt.save(os.path.join(OUT, 'avatars', f'{slug}.jpg'), 'JPEG', quality=84, optimize=True)
        manifest[slug] = {'cover': f'/demo/marketplace/covers/{slug}.jpg',
                          'avatar': f'/demo/marketplace/avatars/{slug}.jpg'}
        print(f'  {slug:32} {src}')

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)
print(f'\n{len(manifest)} profiles rendered, {ok} from Unsplash -> public/demo/marketplace/')

# ── Portfolio thumbnails ─────────────────────────────────────────────────────
# The UGC-creator and services references show a strip of recent work under each
# profile. Demo profiles share one curated pool of content-style photography,
# assigned deterministically by the seeder, rather than each profile needing its
# own shoot. Pool images are square so the strip crops predictably.
POOL = [
    '1556228720-195a672e8a03', '1522335789203-aabd1fc54bc9', '1556228578-8c89e6adf883',
    '1571781926291-c477ebfd024b', '1499951360447-b19be8fe80f5', '1585386959984-a4155224a1ad',
    '1526170375885-4d8ecf77b99f', '1522337360788-8b13dee7a37e', '1547592180-85f173990554',
    '1503481766315-7a586b20f66d', '1560769629-975ec94e6a86', '1491553895911-0055eca6402d',
    '1526947425960-945c6e72858f', '1560343090-f0409e92791a', '1545239351-ef35f43d514b',
    '1596462502278-27bfdc403348', '1512496015851-a90fb38ba796', '1571019613454-1cb2f99b2d8b',
    '1540555700478-4be289fbecef', '1586495777744-4413f21062fa', '1607083206869-4c7672e72a8a',
    '1556909212-d5b604d0c90d', '1583743814966-8936f5b7be1a', '1598300042247-d088f8ab3a91',
]

POOL_DIR = os.path.join(OUT, 'portfolio')
os.makedirs(POOL_DIR, exist_ok=True)
pool_ok = 0
for index, pid in enumerate(POOL):
    path = os.path.join(POOL_DIR, f'pool-{index:02d}.jpg')
    try:
        im = crop_to(fetch(pid, 600), (240, 240))
        pool_ok += 1
    except Exception as exc:
        im = designed(f'Work {index + 1}', (240, 240), f'pool{index}')
    im.save(path, 'JPEG', quality=82, optimize=True)
print(f'{len(POOL)} portfolio thumbnails rendered, {pool_ok} from Unsplash -> public/demo/marketplace/portfolio/')
