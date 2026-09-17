"""Render the Creators & UGC demo media.

Creator avatars go to public/demo/creators/avatars/ (demo profile photos, same
approach as the Marketplace seed). UGC submission media goes to
scripts/seed-media/creators/ and is NOT public: scripts/seed-creators-demo.mjs
uploads it into the private `ugc-submissions` bucket, and the app only ever
reads it back through short-lived signed URLs.

Photos come from Unsplash (Unsplash Licence: free for commercial use, no
attribution required). Any photo that cannot be fetched falls back to a
designed gradient so seeding never depends on network luck.

Run: python scripts/render-creators-seed-media.py
"""
import io, os, urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
AVATARS = os.path.join(ROOT, 'public', 'demo', 'creators', 'avatars')
CONTENT = os.path.join(os.path.dirname(__file__), 'seed-media', 'creators')
os.makedirs(AVATARS, exist_ok=True)
os.makedirs(CONTENT, exist_ok=True)


def font(size):
    for name in ('segoeuib.ttf', 'arialbd.ttf'):
        p = os.path.join('C:/Windows/Fonts', name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def fetch(pid, w=1000):
    url = f'https://images.unsplash.com/photo-{pid}?w={w}&q=82&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'CaptionFoxSeed/1.0'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=45).read())).convert('RGB')


def crop_to(im, size, top_bias=False):
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = 0 if top_bias else (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def fallback(label, size, colours):
    im = Image.new('RGB', size, colours[0])
    draw = ImageDraw.Draw(im)
    for y in range(size[1]):
        t = y / size[1]
        c = tuple(round(colours[0][i] * (1 - t) + colours[1][i] * t) for i in range(3))
        draw.line([(0, y), (size[0], y)], fill=c)
    initials = ''.join(part[0] for part in label.split()[:2]).upper()
    f = font(size[0] // 3)
    box = draw.textbbox((0, 0), initials, font=f)
    draw.text(((size[0] - box[2]) / 2, (size[1] - box[3]) / 2), initials, font=f, fill=(255, 255, 255))
    return im


# Creator avatars: slug -> Unsplash portrait id.
PEOPLE = {
    'lena-park': '1438761681033-6461ffad8d80',
    'noah-rivera': '1507003211169-0a1dd7228f2d',
    'maya-chen': '1534528741775-53994a69daeb',
    'ethan-brooks': '1500648767791-00dcc994a43e',
    'sofia-martinez': '1494790108377-be9c29b29330',
    'james-walker': '1472099645785-5658abf4ff4e',
    'aisha-patel': '1544005313-94ddf0286df2',
    'lucas-martin': '1519085360753-af0119f7cbe7',
    'ella-johnson': '1517841905240-472988babdf9',
    'daniel-kim': '1506794778202-cad84cf45f1d',
    'olivia-bennett': '1554151228-14d9def656e4',
    'ryan-carter': '1508214751196-bcfd4ca60f91',
    'hannah-lee': '1524504388940-b1c1722653e1',
    'tyler-adams': '1531123897727-8f129e1688ce',
    'emma-johnson': '1487412720507-e7ab37603c6f',
    'liam-anderson': '1463453091185-61582044d556',
}

# UGC content: slug -> Unsplash id. Filenames are what the seed references.
SHOTS = {
    'skincare-bottle': '1608571423902-eed4a5ad8108',
    'hiker-portrait': '1500534314209-a25ddb2bd429',
    'healthy-bowl': '1512621776951-a57141f2eefd',
    'camera-lens': '1510127034890-ba27508e9f1c',
    'summer-drink': '1513558161293-cdaf765ed2fd',
    'skincare-flatlay': '1612817288484-6f916006741a',
    'makeup-tutorial': '1596462502278-27bfdc403348',
    'mountain-hiker': '1551632811-561732d1e306',
    'beach-day': '1507525428034-b723cf961d3e',
    'product-unboxing': '1698376621004-70ce754157d1',
    'morning-routine': '1620916566398-39f1143ab7be',
    'city-exploration': '1514924013411-cbf25faa35bb',
    'home-cooking': '1547592180-85f173990554',
    'workout-session': '1571019613454-1cb2f99b2d8b',
    'coffee-moment': '1559056199-641a0ac8b55e',
    'tech-desk': '1498050108023-c5249f4df085',
    'sneaker-drop': '1600185365483-26d7a4cc7519',
    'headphones-review': '1505740420928-5e560c06d30e',
}

PALETTES = [((37, 99, 235), (124, 58, 237)), ((16, 185, 129), (13, 148, 136)), ((249, 115, 22), (234, 88, 12))]


def main():
    for i, (slug, pid) in enumerate(PEOPLE.items()):
        out = os.path.join(AVATARS, f'{slug}.jpg')
        if os.path.exists(out):
            continue
        try:
            im = crop_to(fetch(pid, 400), (240, 240), top_bias=True)
        except Exception as exc:  # network or 404: designed fallback
            print('avatar fallback', slug, exc)
            im = fallback(slug.replace('-', ' '), (240, 240), PALETTES[i % len(PALETTES)])
        im.save(out, 'JPEG', quality=86)
        print('avatar', slug)

    for i, (slug, pid) in enumerate(SHOTS.items()):
        out = os.path.join(CONTENT, f'{slug}.jpg')
        if os.path.exists(out):
            continue
        try:
            im = crop_to(fetch(pid, 1000), (800, 600))
        except Exception as exc:
            print('shot fallback', slug, exc)
            im = fallback(slug.replace('-', ' '), (800, 600), PALETTES[i % len(PALETTES)])
        im.save(out, 'JPEG', quality=84)
        print('shot', slug)


if __name__ == '__main__':
    main()
