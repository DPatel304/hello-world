import numpy as np, wave, re, json, sys
SR = 44100
# clip lengths, in order (from clips.mjs)
src = open('clips.mjs').read()
clips = re.findall(r"\['(\w+)', ([\d.]+),", src)
T = {}; t = 0
for name, secs in clips:
    T[name] = (t, t + float(secs)); t += float(secs)
TOTAL = t
n = int(TOTAL * SR) + SR
L = np.zeros(n); R = np.zeros(n)
def note(f): return 440 * 2 ** ((f - 69) / 12)
def add(buf, start, sig):
    i = int(start * SR); j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i]
def env(dur, a=0.05, r=0.5):
    k = np.arange(int(dur * SR)) / SR
    e = np.minimum(1, k / max(a, 1e-3)) * np.minimum(1, np.maximum(0, (dur - k) / max(r, 1e-3)))
    return e
def pad(f, dur, vol, a=1.5, r=2.0, bright=0.3):
    k = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * m * k + m) / m ** 1.5 for m in (1, 2, 3)) * (1 - bright) + bright * np.sin(2 * np.pi * f * 4 * k) * 0.2
    s += 0.5 * np.sin(2 * np.pi * f * 1.003 * k)          # gentle chorus
    return s * env(dur, a, r) * vol
def pluck(f, dur, vol):
    k = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * k) + 0.3 * np.sin(2 * np.pi * f * 2 * k) * np.exp(-k * 6)) * np.exp(-k * 3.5) * vol
def chord(start, dur, notes, vol, **kw):
    for q, m in enumerate(notes):
        s = pad(note(m), dur, vol, **kw); pan = 0.5 + 0.3 * np.sin(q * 1.7)
        add(L, start, s * (1 - pan)); add(R, start, s * pan)
def noise_swell(start, dur, vol):
    k = np.arange(int(dur * SR)) / SR
    s = np.random.randn(len(k)); s = np.convolve(s, np.ones(40) / 40, 'same')
    s *= (k / dur) ** 2 * vol
    add(L, start, s); add(R, start, s)
def boom(start, vol):
    k = np.arange(int(1.6 * SR)) / SR
    f = 55 * np.exp(-k * 1.5) + 30
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k * 2.2) * vol
    add(L, start, s); add(R, start, s)
def chime(start, f, vol):
    s = pluck(note(f), 2.5, vol); add(L, start, s * 0.6); add(R, start, s)

# I: wonder - the wake and the walk up: soft low pad (D major-ish, Lydian sparkle)
a0, a1 = T['wake'][0], T['climb'][1]
chord(a0, a1 - a0 + 1.5, [50, 57, 62, 66], 0.05, a=2.5, r=1.5)
for k, m in enumerate([74, 76, 81, 78, 74, 76, 69, 74]):
    chime(T['walk'][0] + k * 0.75, m, 0.06)
# the crest: a swell, then the full open chord as the world opens
noise_swell(T['crest'][0], 2.0, 0.06)
c0 = T['crest'][0] + 1.6
chord(c0, 6.5, [38, 50, 57, 62, 66, 69, 76], 0.06, a=1.2, r=3.0)
chime(c0, 81, 0.09); chime(c0 + 0.4, 86, 0.07)
# II: the world - a gentle walking melody over shifting chords, a little plucked arpeggio
w0, w1 = T['jellies'][0], T['ride'][0]
prog = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59, 62], [45, 52, 57, 61]]
# (the world part, minus the robots' dark bit)
dark0, dark1 = T['robots'][0], T['robots'][1]
bar = 2.4; tt = w0; q = 0
while tt < dark0 - 0.2:
    ch = prog[q % 4]; dur = min(bar, dark0 - tt)
    chord(tt, dur + 1.2, ch, 0.035, a=0.4, r=1.2)
    for k in range(8):
        if tt + k * bar / 8 < dark0 - 0.2: s = pluck(note(ch[k % len(ch)] + 24), 0.8, 0.05); add(L if k % 2 else R, tt + k * bar / 8, s)
    tt += bar; q += 1
melody = [74, 76, 78, 81, 78, 76, 74, 71, 73, 74, 76, 74]
for k, m in enumerate(melody):
    at = w0 + 0.6 + k * 1.2
    if at < dark0 - 0.5: s = pluck(note(m), 1.6, 0.08); add(L, at, s * 0.8); add(R, at, s)
# the robots: everything drops away - a low drone, a boom
boom(dark0 + 0.15, 0.5)
chord(dark0, dark1 - dark0 + 0.5, [38, 44, 50], 0.05, a=0.3, r=0.6, bright=0)
# III: the ride and the title - warm and big, resolving
r0 = T['ride'][0]
chord(r0, T['ride'][1] - r0 + 1.0, [43, 55, 59, 62, 67], 0.05, a=0.6, r=1.0)
for k, m in enumerate([79, 81, 83, 86]): chime(r0 + 0.3 + k * 0.8, m, 0.07)
t0 = T['title'][0]
chord(t0, T['title'][1] - t0 + 0.2, [38, 50, 57, 62, 66, 69, 74], 0.06, a=0.8, r=2.5)
chime(t0 + 0.2, 74, 0.09); chime(t0 + 0.6, 81, 0.08); chime(t0 + 1.0, 86, 0.07)
boom(t0 + 0.05, 0.25)
# master: soft limit, fade out
m = np.stack([L, R], 1)
m = np.tanh(m * 2.2) / 2.2 * 1.6
fade = np.ones(len(m)); fl = int(1.2 * SR); end = int(TOTAL * SR); fade[end - fl:end] = np.linspace(1, 0, fl); fade[end:] = 0
m *= fade[:, None]
m = m[:end]
m /= max(1e-6, np.abs(m).max()) / 0.85
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((m * 32767).astype(np.int16).tobytes())
print('total', round(TOTAL, 2), 's'); print(json.dumps({k: [round(a, 2), round(b, 2)] for k, (a, b) in T.items()}))
