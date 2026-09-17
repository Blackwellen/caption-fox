"""Render the Campaigns demo media into supabase/seed-media/campaigns/.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required, no Unsplash+ premium ids). Giveaway / competition banners
get their overlay wordmarks drawn here so they stay sharp at card size and
carry no third-party brand marks.

Output:
  campaigns/<slug>.jpg     480x360 campaign card thumbnails
  giveaways/<slug>.jpg     960x400 giveaway banners (with drawn overlay text)
  competitions/<slug>.jpg  960x400 competition covers
  templates/<slug>.jpg     480x360 template covers
  avatars/<slug>.jpg       320x320 demo teammate portraits
  manifest.json            logical key -> relative file path

Every download has a deterministic designed-gradient fallback, so a dead photo
id degrades to a branded cover instead of failing the whole render.

Run: python scripts/render-campaigns-seed-media.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'seed-media', 'campaigns')
for sub in ('campaigns', 'giveaways', 'competitions', 'templates', 'avatars'):
    os.makedirs(os.path.join(ROOT, sub), exist_ok=True)

FONT_DIR = 'C:/Windows/Fonts'


def font(size, bold=False):
    names = ('segoeuib.ttf', 'arialbd.ttf') if bold else ('segoeui.ttf', 'arial.ttf')
    for name in names:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


_cache = {}
_failed = set()


def photo(pid, w=1600):
    """Fetch an Unsplash photo, or None when the id is unavailable."""
    key = (pid, w)
    if pid in _failed:
        return None
    if key not in _cache:
        url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=90&fm=jpg'
        req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
        try:
            data = urllib.request.urlopen(req, timeout=60).read()
            _cache[key] = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception as exc:                                    # noqa: BLE001
            print(f'  ! photo-{pid} unavailable ({exc}) — using designed fallback')
            _failed.add(pid)
            return None
    return _cache[key].copy()


def cover(im, size):
    """Centre-crop to fill `size` exactly (no letterboxing, no stretching)."""
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left, top = (im.width - tw) // 2, (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def save(im, path):
    im.save(path, 'JPEG', quality=88, optimize=True, progressive=True)


BLUE, NAVY, WHITE = (37, 99, 235), (15, 23, 42), (255, 255, 255)

TINTS = [
    ((219, 234, 254), (37, 99, 235)), ((237, 233, 254), (109, 40, 217)),
    ((209, 250, 229), (5, 150, 105)), ((254, 243, 199), (180, 83, 9)),
    ((255, 228, 230), (190, 18, 60)), ((224, 242, 254), (2, 132, 199)),
]


def gradient(size, pair):
    """Deterministic two-tone diagonal wash used by every fallback cover."""
    top, bottom = pair
    w, h = size
    base = Image.new('RGB', size, top)
    mask = Image.linear_gradient('L').resize(size).rotate(35, expand=False)
    return Image.composite(Image.new('RGB', size, bottom), base, mask)


def designed(title, sub, size, seed=0):
    """Branded fallback cover — a gradient wash with the record's own words."""
    im = gradient(size, TINTS[seed % len(TINTS)])
    d = ImageDraw.Draw(im)
    w, h = size
    d.text((w * 0.07, h * 0.36), title.upper(), font=font(int(h * 0.15), True), fill=WHITE)
    if sub:
        d.text((w * 0.07, h * 0.58), sub, font=font(int(h * 0.09)), fill=(255, 255, 255, 220))
    return im


def wrap(d, text, fnt, max_w):
    words, lines, line = text.split(), [], ''
    for word in words:
        trial = f'{line} {word}'.strip()
        if d.textlength(trial, font=fnt) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def banner(pid, headline, kicker, size=(960, 400), align='right', seed=0, dark=False):
    """A giveaway / competition banner: photo, scrim, drawn overlay wordmark."""
    src = photo(pid, 1600)
    im = cover(src, size) if src else gradient(size, TINTS[seed % len(TINTS)])
    w, h = size

    # Directional scrim so the drawn type always clears the photo behind it.
    scrim = Image.new('L', size, 0)
    sd = ImageDraw.Draw(scrim)
    for x in range(w):
        t = x / w if align == 'right' else 1 - x / w
        sd.line([(x, 0), (x, h)], fill=int(210 * max(0.0, t * 1.25 - 0.18)))
    im = Image.composite(Image.new('RGB', size, NAVY if dark else WHITE), im, scrim)

    d = ImageDraw.Draw(im)
    ink = WHITE if dark else (17, 24, 39)
    big = font(int(h * 0.19), True)
    small = font(int(h * 0.062), True)
    lines = wrap(d, headline.upper(), big, w * 0.46)
    block = len(lines) * int(h * 0.20) + int(h * 0.11)
    y = (h - block) // 2
    for line in lines:
        tw = d.textlength(line, font=big)
        x = w * 0.96 - tw if align == 'right' else w * 0.04
        d.text((x, y), line, font=big, fill=ink)
        y += int(h * 0.20)
    tw = d.textlength(kicker.upper(), font=small)
    x = w * 0.96 - tw if align == 'right' else w * 0.04
    d.text((x, y + int(h * 0.02)), kicker.upper(), font=small, fill=ink)
    return im


# ---------------------------------------------------------------------------
# Photo ids. The first block is re-used from the Brand & Assets seed renderer,
# where each id was checked visually; the rest are plain Unsplash Licence
# photos with no visible third-party branding.
P = {
    'shoe_white': '1603808033192-082d6919d3e1',     'headphones': '1583394838336-acd977736f90',
    'headphones_yellow': '1505740420928-5e560c06d30e', 'headphones_navy': '1566478989151-541ffa519573',
    'coffee': '1559056199-641a0ac8b55e', 'bag': '1590874103328-eac38a683ce7',
    'box': '1698376621004-70ce754157d1', 'flatlay': '1612817288484-6f916006741a',
    'makeup': '1596462502278-27bfdc403348',     'chair': '1598300042247-d088f8ab3a91', 'woman_blue': '1531746020798-e6953c6e8e04',
    'hike': '1551632811-561732d1e306', 'phone_app': '1551650975-87deedd944c3',
    'skincare': '1596755389378-c31d21fd1273',
    'backpack': '1622560480605-d83c853bc5c3', 'serum': '1608571423902-eed4a5ad8108',
    'protein_bar': '1633360821154-1935fb5671e6',
    'tote_dark': '1572196284554-4e321b0e7e0b',
    # Scene / lifestyle photography for campaign thumbnails and covers.
    'desk': '1497366754035-f200968a6e72', 'laptop': '1498050108023-c5249f4df085',
    'meeting': '1522071820081-009f0129c71c', 'camera': '1510127034890-ba27508e9f1c', 'adventure': '1500534314209-a25ddb2bd429',
    'gifts': '1513885535751-8b9238bd345a', 'fireworks': '1467810563316-b5476525c0f9',
    'beach': '1507525428034-b723cf961d3e', 'newsletter': '1586953208448-b95a79798f07',
    'sale_tag': '1607083206869-4c7672e72a8a', 'city_night': '1514924013411-cbf25faa35bb',
    'studio': '1542744173-8e7e53415bb0',     'plant_room': '1524758631624-e2822e304c36', 'pastel': '1557683316-973673baf926',
    'confetti': '1530103862676-de8c9debad1d', 'workout': '1571019613454-1cb2f99b2d8b',
}

AVATAR_IDS = {
    'emma-davis': '1438761681033-6461ffad8d80',
    'liam-chen': '1507003211169-0a1dd7228f2d',
    'sophia-patel': '1534528741775-53994a69daeb',
    'noah-williams': '1500648767791-00dcc994a43e',
    'olivia-martinez': '1494790108377-be9c29b29330',
    'ethan-roberts': '1472099645785-5658abf4ff4e',
    'ava-martinez': '1544005313-94ddf0286df2',
    'mason-lee': '1519085360753-af0119f7cbe7',
    'mia-thompson': '1517841905240-472988babdf9',
}

# slug -> (photo key, fallback title)
CAMPAIGN_THUMBS = {
    'summer-launch-2024': ('shoe_white', 'Summer Launch'),
    'brand-awareness-q2': ('headphones', 'Awareness Q2'),
    'giveaway-win-big': ('gifts', 'Win Big'),
    'customer-stories': ('meeting', 'Customer Stories'),
    'spring-sale-push': ('sale_tag', 'Spring Sale'),
    'webinar-series-q2': ('laptop', 'Webinar Series'),
    'referral-boost': ('confetti', 'Referral Boost'),
    'product-teaser': ('box', 'Product Teaser'),
    'back-to-school-promo': ('backpack', 'Back to School'),
    'holiday-collection-teaser': ('pastel', 'Holiday Teaser'),
    'email-newsletter-boost': ('newsletter', 'Newsletter'),
    'flash-sale-weekend': ('studio', 'Flash Sale'),
    'spring-collection-launch': ('bag', 'Spring Collection'),
    'brand-awareness-q1': ('woman_blue', 'Awareness Q1'),
    'customer-stories-q1': ('desk', 'Stories Q1'),
    'valentines-day-campaign': ('pastel', "Valentine's"),
    'january-clearance-sale': ('tote_dark', 'Clearance'),
    'new-year-new-you': ('city_night', 'New Year'),
    'app-relaunch-campaign': ('phone_app', 'App Relaunch'),
    'q2-paid-acquisition': ('flatlay', 'Paid Acquisition'),
    'influencer-partnership': ('makeup', 'Influencer'),
    'autumn-essentials-edit': ('plant_room', 'Autumn Edit'),
    'loyalty-club-relaunch': ('coffee', 'Loyalty Club'),
    'wellness-week': ('skincare', 'Wellness Week'),
    'studio-tour-series': ('chair', 'Studio Tour'),
    'gift-guide-2024': ('bag', 'Gift Guide'),
    'creator-collab-drop': ('shoe_white', 'Creator Collab'),
    'sustainability-story': ('plant_room', 'Sustainability'),
    'weekend-flash-drop': ('serum', 'Flash Drop'),
    'trade-show-roadshow': ('meeting', 'Roadshow'),
    'always-on-retargeting': ('protein_bar', 'Retargeting'),
    'press-launch-kit': ('box', 'Press Kit'),
    'community-ambassadors': ('hike', 'Ambassadors'),
    'seasonal-bundle-offer': ('headphones_navy', 'Bundle Offer'),
    'video-shorts-sprint': ('camera', 'Shorts Sprint'),
    'winter-warmers-push': ('headphones_yellow', 'Winter Warmers'),
}

GIVEAWAYS = {
    'summer-sneakers-giveaway': ('shoe_white', 'Step Into Summer', 'Sneaker giveaway', 'right', False),
    'tech-upgrade-giveaway': ('headphones_navy', 'Tech Upgrade', 'Giveaway', 'right', True),
    'mothers-day-giveaway': ('gifts', "Mother's Day", 'Giveaway', 'right', False),
    'dream-vacation-giveaway': ('beach', 'Dream Vacation', 'Giveaway', 'right', False),
    'photography-kit-giveaway': ('camera', 'Photography Kit', 'Giveaway', 'right', True),
}

COMPETITIONS = {
    'capture-the-adventure': ('adventure', 'Capture the Adventure', 'Photo competition', 'left', True),
    'latte-art-showdown': ('coffee', 'Latte Art Showdown', 'Photo competition', 'left', True),
    'design-your-space': ('chair', 'Design Your Space', 'Design competition', 'left', False),
    'celebrate-and-win': ('fireworks', 'Celebrate & Win', 'Photo competition', 'left', True),
    'eco-innovators-challenge': ('plant_room', 'Eco Innovators', 'Video competition', 'left', False),
}

TEMPLATES = {
    'summer-launch-2024': ('shoe_white', 'Summer Launch'),
    'brand-awareness-q2': ('woman_blue', 'Awareness Q2'),
    'giveaway-win-big': ('gifts', 'Win Big'),
    'customer-stories': ('desk', 'Customer Stories'),
    'referral-boost': ('confetti', 'Referral Boost'),
    'back-to-school-giveaway': ('backpack', 'Back to School'),
    'holiday-promo-2024': ('pastel', 'Holiday Promo'),
    'webinar-series-template': ('laptop', 'Webinar Series'),
    'product-launch-playbook': ('box', 'Launch Playbook'),
    'seasonal-sale-blueprint': ('sale_tag', 'Seasonal Sale'),
}

manifest = {'campaigns': {}, 'giveaways': {}, 'competitions': {}, 'templates': {}, 'avatars': {}}

for i, (slug, (key, title)) in enumerate(CAMPAIGN_THUMBS.items()):
    src = photo(P[key], 1200)
    im = cover(src, (480, 360)) if src else designed(title, '', (480, 360), i)
    save(im, os.path.join(ROOT, 'campaigns', f'{slug}.jpg'))
    manifest['campaigns'][slug] = f'campaigns/{slug}.jpg'
    print('campaign', slug)

for i, (slug, (key, head, kick, align, dark)) in enumerate(GIVEAWAYS.items()):
    save(banner(P[key], head, kick, (960, 400), align, i, dark), os.path.join(ROOT, 'giveaways', f'{slug}.jpg'))
    manifest['giveaways'][slug] = f'giveaways/{slug}.jpg'
    print('giveaway', slug)

for i, (slug, (key, head, kick, align, dark)) in enumerate(COMPETITIONS.items()):
    save(banner(P[key], head, kick, (960, 400), align, i + 2, dark), os.path.join(ROOT, 'competitions', f'{slug}.jpg'))
    manifest['competitions'][slug] = f'competitions/{slug}.jpg'
    print('competition', slug)

for i, (slug, (key, title)) in enumerate(TEMPLATES.items()):
    src = photo(P[key], 1200)
    im = cover(src, (480, 360)) if src else designed(title, '', (480, 360), i + 1)
    save(im, os.path.join(ROOT, 'templates', f'{slug}.jpg'))
    manifest['templates'][slug] = f'templates/{slug}.jpg'
    print('template', slug)

for i, (person, pid) in enumerate(AVATAR_IDS.items()):
    src = photo(pid, 800)
    if src:
        # Faces sit in the upper third of these portraits; bias the crop upward.
        side = min(src.width, src.height)
        top = max(0, int(src.height * 0.08)) if src.height > src.width else 0
        left = (src.width - side) // 2
        im = src.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
    else:
        initials = ''.join(part[0] for part in person.split('-')[:2]).upper()
        im = gradient((320, 320), TINTS[i % len(TINTS)])
        d = ImageDraw.Draw(im)
        fnt = font(128, True)
        tw = d.textlength(initials, font=fnt)
        d.text(((320 - tw) / 2, 88), initials, font=fnt, fill=WHITE)
    save(im, os.path.join(ROOT, 'avatars', f'{person}.jpg'))
    manifest['avatars'][person] = f'avatars/{person}.jpg'
    print('avatar', person)

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf8') as fh:
    json.dump(manifest, fh, indent=2)

total = sum(len(v) for v in manifest.values())
print(f'\n{total} files written to supabase/seed-media/campaigns/')
if _failed:
    print(f'{len(_failed)} photo id(s) fell back to designed covers: {sorted(_failed)}')
