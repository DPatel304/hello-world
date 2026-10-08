"""Synthetic camera footage for the tests.

Chromium can be handed a .y4m file in place of a real webcam, which is how
the vision pipeline gets tested without a room and two toddlers. The room
here is deliberately textured: a flat-coloured one is the unrealistic case,
because shifting plain grey by a few pixels changes nothing, and an early
version of this clip registered no camera bump at all because of it.

Usage:  python3 test/mkclip.py <out.y4m> [seconds] [bump_at_seconds]
"""
import math, random
from PIL import Image, ImageDraw, ImageFilter

W, H, FPS = 640, 480, 30
M = 40                       # margin, so a camera bump has somewhere to shift into
CW, CH = W + M*2, H + M*2

def grain(size, sigma, stretch, seed):
    """Texture. A flat-coloured room is the unrealistic case: shifting plain
       grey by a few pixels changes nothing, which is why the first version of
       this clip registered no bump at all. Real floors and rugs have grain."""
    w, h = size
    n = Image.effect_noise((max(4, w//stretch), h), sigma)
    return n.resize((w, h), Image.BILINEAR).filter(ImageFilter.SMOOTH)

def texture(im, box, sigma, stretch, seed, amt):
    x0, y0, x1, y1 = box
    g = grain((x1-x0, y1-y0), sigma, stretch, seed).convert('L')
    patch = im.crop(box)
    im.paste(Image.blend(patch, Image.merge('RGB', (g, g, g)), amt), box)

def room():
    """A plain living room. The background model needs real texture to lock on
       to - a bump against a featureless wall is invisible, which is exactly
       the mistake that invalidated the first bump clip."""
    im = Image.new('RGB', (CW, CH), (150, 146, 138))
    d = ImageDraw.Draw(im)
    floor = int(CH*0.62)
    d.rectangle([0, floor, CW, CH], fill=(118, 106,  96))      # floor
    d.rectangle([0, floor-5, CW, floor], fill=(96, 86, 78))    # skirting
    d.rectangle([28, floor-96, 232, floor+16], fill=(84, 92, 104))   # couch
    d.rectangle([40, floor-88, 108, floor-46], fill=(99, 108, 122))  # cushion
    d.rectangle([116, floor-88, 184, floor-46], fill=(99, 108, 122)) # cushion
    d.rectangle([470, 60, 596, 150], fill=(122, 112, 100))           # picture
    d.rectangle([478, 68, 588, 142], fill=(158, 140, 116))
    d.ellipse([330, floor+40, 650, floor+150], fill=(104, 94, 88))   # rug
    d.rectangle([606, floor-150, 626, floor+10], fill=(90, 84, 78))  # lamp stand
    d.polygon([(560, floor-150), (612, floor-150), (604, floor-196), (568, floor-196)],
              fill=(176, 166, 142))                                   # shade
    # a bookshelf: lots of small high-contrast edges, the thing a real room has
    sx, sy = 452, floor-176
    d.rectangle([sx, sy, sx+176, floor+8], fill=(88, 72, 58))
    rnd = random.Random(3)
    for shelf in range(3):
        yb = sy + 12 + shelf*56
        d.rectangle([sx+6, yb+44, sx+170, yb+50], fill=(68, 56, 44))
        x = sx + 10
        while x < sx + 164:
            bw = rnd.randint(7, 15)
            bh = rnd.randint(30, 42)
            c  = rnd.choice([(150,92,70),(94,110,128),(168,150,104),(110,128,98),(140,120,140)])
            d.rectangle([x, yb+44-bh, x+bw, yb+44], fill=c)
            x += bw + 2
    # a striped rug, and grain on the floor and the wall
    for k in range(9):
        d.ellipse([330+k*3, floor+40+k*5, 650-k*3, floor+150-k*5],
                  outline=(126,112,100) if k % 2 else (96,88,82), width=5)
    texture(im, (0, floor, CW, CH), 26, 3, 1, 0.30)      # floorboards
    texture(im, (0, 0, CW, floor), 12, 1, 2, 0.14)        # wall
    return im

def person(d, cx, foot, h, phase, col):
    head_r   = h*0.125
    head_cy  = foot - h + head_r
    torso_t  = head_cy + head_r*0.85
    torso_b  = foot - h*0.40
    swing    = math.sin(phase*2*math.pi) * h*0.13
    lw       = max(2, int(h*0.085))
    d.line([(cx, torso_b), (cx - swing, foot)], fill=col, width=lw)
    d.line([(cx, torso_b), (cx + swing, foot)], fill=col, width=lw)
    d.rounded_rectangle([cx-h*0.115, torso_t, cx+h*0.115, torso_b],
                        radius=h*0.055, fill=col)
    ay = torso_t + h*0.07
    a  = math.sin(phase*2*math.pi + 1.1)
    aw = max(2, int(h*0.068))
    d.line([(cx-h*0.10, ay), (cx-h*0.30, ay - a*h*0.26)], fill=col, width=aw)
    d.line([(cx+h*0.10, ay), (cx+h*0.30, ay + a*h*0.26)], fill=col, width=aw)
    d.ellipse([cx-head_r, head_cy-head_r, cx+head_r, head_cy+head_r], fill=col)

def build(path, seconds, bump_at):
    base   = room()
    floor  = int(CH*0.62)
    frames = int(seconds*FPS)
    rnd    = random.Random(7)
    with open(path, 'wb') as f:
        f.write(b'YUV4MPEG2 W%d H%d F%d:1 Ip A1:1 C420jpeg XYSCSS=420JPEG\n' % (W, H, FPS))
        for n in range(frames):
            t  = n / FPS
            im = base.copy()
            d  = ImageDraw.Draw(im)
            if t > 2.6:                       # calibration happens on an empty room
                u = t - 2.6
                # grown-up, left of frame, big slow strides
                person(d, CW*0.34 + math.sin(u*0.9)*CW*0.14, floor + 92,
                       250, u*1.15, (46, 52, 74))
                # toddler, right of frame, twice the tempo and half the size
                person(d, CW*0.70 + math.sin(u*1.7 + 2.0)*CW*0.13,
                       floor + 96 - abs(math.sin(u*3.4))*14,
                       150, u*2.3, (104, 44, 44))
            # the knock: a permanent shift, not a wobble
            dx, dy = (26, -16) if t >= bump_at else (0, 0)   # ~2.4 degrees at this FOV
            im = im.crop((M+dx, M+dy, M+dx+W, M+dy+H))
            # sensor grain, so the pipeline sees something like a real webcam
            noise = Image.effect_noise((W, H), 5).convert('L')
            im = Image.blend(im, Image.merge('RGB', (noise, noise, noise)), 0.06)
            y, cb, cr = im.convert('YCbCr').split()
            f.write(b'FRAME\n')
            f.write(y.tobytes())
            f.write(cb.resize((W//2, H//2), Image.BILINEAR).tobytes())
            f.write(cr.resize((W//2, H//2), Image.BILINEAR).tobytes())
    print(path, frames, 'frames,', round(seconds,1), 's')

if __name__ == '__main__':
    import os, sys
    out = sys.argv[1] if len(sys.argv) > 1 else '.clips/demo.y4m'
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 15.0
    bump = float(sys.argv[3]) if len(sys.argv) > 3 else 9.4
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    build(out, secs, bump)
