/**
 * A small player for the site's Webflow "Interactions" (hover, click, page-load
 * and scroll animations). The animation data in src/data/interactions.json was
 * exported from the Webflow site as-is; this file replays it without Webflow's
 * own runtime or jQuery.
 *
 * Supported triggers: hover in/out, click / second click, page start/finish,
 * scroll into/out of view, while scrolling in view, mouse move over element.
 * Supported actions: move, scale, rotate, opacity, size, filter, text colour,
 * background colour, border colour, display, and Webflow's built-in slide presets.
 */

type Obj = Record<string, any>;
type Unit = string;
interface Val { v: number; u: Unit }

interface ElState {
  tx: Val; ty: Val; tz: Val;
  sx: number; sy: number; sz: number;
  rx: Val; ry: Val; rz: Val;
  skx: Val; sky: Val;
  hasTransform: boolean;
  opacity?: number;
  width?: Val; height?: Val;
  filters?: Map<string, Val>;
  color?: number[]; bg?: number[]; border?: number[];
}

const BREAKPOINTS: [string, number][] = [['main', 992], ['medium', 768], ['small', 480], ['tiny', 0]];
const breakpoint = () => BREAKPOINTS.find(([, min]) => window.innerWidth >= min)![0];

// ---------------------------------------------------------------- easing

const bezier = (x1: number, y1: number, x2: number, y2: number) => (t: number) => {
  // Newton-Raphson on x(t), then y(t)
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sy = (s: number) => ((ay * s + by) * s + cy) * s;
  let s = t;
  for (let i = 0; i < 8; i++) {
    const x = sx(s) - t;
    const d = (3 * ax * s + 2 * bx) * s + cx;
    if (Math.abs(x) < 1e-5 || Math.abs(d) < 1e-6) break;
    s -= x / d;
  }
  return sy(Math.min(1, Math.max(0, s)));
};
const pow = (p: number) => ({
  in: (t: number) => t ** p,
  out: (t: number) => 1 - (1 - t) ** p,
  inOut: (t: number) => (t < 0.5 ? 2 ** (p - 1) * t ** p : 1 - (-2 * t + 2) ** p / 2),
});
const quad = pow(2), cubic = pow(3), quart = pow(4), quint = pow(5);
const BACK = 1.70158;
const bounceOut = (t: number) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const EASINGS: Record<string, (t: number) => number> = {
  '': (t) => t, linear: (t) => t,
  ease: bezier(0.25, 0.1, 0.25, 1),
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  easeInOut: bezier(0.42, 0, 0.58, 1),
  inQuad: quad.in, outQuad: quad.out, inOutQuad: quad.inOut,
  inCubic: cubic.in, outCubic: cubic.out, inOutCubic: cubic.inOut,
  inQuart: quart.in, outQuart: quart.out, inOutQuart: quart.inOut,
  inQuint: quint.in, outQuint: quint.out, inOutQuint: quint.inOut,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => (t === 0 || t === 1 ? t : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - (t - 1) ** 2),
  inOutCirc: (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
  inBack: (t) => (BACK + 1) * t ** 3 - BACK * t * t,
  outBack: (t) => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2,
  inOutBack: (t) => {
    const c = BACK * 1.525;
    return t < 0.5 ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2 : ((2 * t - 2) ** 2 * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  outBounce: bounceOut,
  inBounce: (t) => 1 - bounceOut(1 - t),
  inOutBounce: (t) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2),
  inElastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))),
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
const ease = (name?: string) => EASINGS[name ?? ''] ?? EASINGS.ease;

// ---------------------------------------------------------------- element state

const states = new WeakMap<HTMLElement, ElState>();
const unitOf = (u?: string) => (u ? u.toLowerCase() : 'px');

function parseInlineTransform(el: HTMLElement, s: ElState) {
  const t = el.style.transform;
  if (!t) return;
  s.hasTransform = true;
  const num = (x: string) => ({ v: parseFloat(x), u: x.replace(/^[-\d.e]+/i, '').toLowerCase() || 'px' });
  const tr = /translate3d\(([^,]+),([^,]+),([^)]+)\)/i.exec(t);
  if (tr) { s.tx = num(tr[1].trim()); s.ty = num(tr[2].trim()); s.tz = num(tr[3].trim()); }
  const sc = /scale3d\(([^,]+),([^,]+),([^)]+)\)/i.exec(t);
  if (sc) { s.sx = parseFloat(sc[1]); s.sy = parseFloat(sc[2]); s.sz = parseFloat(sc[3]); }
  const rot = (axis: string) => {
    const m = new RegExp(`rotate${axis}\\(([^)]+)\\)`, 'i').exec(t);
    return m ? num(m[1].trim()) : undefined;
  };
  s.rx = rot('X') ?? s.rx; s.ry = rot('Y') ?? s.ry; s.rz = rot('Z') ?? s.rz;
  const sk = /skew\(([^,]+),([^)]+)\)/i.exec(t);
  if (sk) { s.skx = num(sk[1].trim()); s.sky = num(sk[2].trim()); }
}

function state(el: HTMLElement): ElState {
  let s = states.get(el);
  if (!s) {
    const z = (u = 'px'): Val => ({ v: 0, u });
    s = { tx: z(), ty: z(), tz: z(), sx: 1, sy: 1, sz: 1, rx: z('deg'), ry: z('deg'), rz: z('deg'), skx: z('deg'), sky: z('deg'), hasTransform: false };
    parseInlineTransform(el, s);
    states.set(el, s);
  }
  return s;
}

function parseColor(c: string): number[] {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return [0, 0, 0, 0];
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
  return [p[0], p[1], p[2], p[3] ?? 1];
}

function readColor(el: HTMLElement, key: 'color' | 'bg' | 'border'): number[] {
  const s = state(el);
  if (!s[key]) {
    const cs = getComputedStyle(el);
    s[key] = parseColor(key === 'color' ? cs.color : key === 'bg' ? cs.backgroundColor : cs.borderTopColor);
  }
  return s[key]!;
}

function readFilters(el: HTMLElement): Map<string, Val> {
  const s = state(el);
  if (!s.filters) {
    s.filters = new Map();
    const f = el.style.filter || getComputedStyle(el).filter;
    if (f && f !== 'none') {
      for (const m of f.matchAll(/([a-z-]+)\(([-\d.]+)([a-z%]*)\)/gi)) s.filters.set(m[1], { v: parseFloat(m[2]), u: m[3] || '' });
    }
  }
  return s.filters;
}

function toPx(val: Val, el: HTMLElement, axis: 'x' | 'y'): number {
  switch (val.u) {
    case '%': return (val.v / 100) * (axis === 'x' ? el.offsetWidth : el.offsetHeight);
    case 'vw': return (val.v / 100) * window.innerWidth;
    case 'vh': return (val.v / 100) * window.innerHeight;
    case 'em': return val.v * parseFloat(getComputedStyle(el).fontSize);
    case 'rem': return val.v * parseFloat(getComputedStyle(document.documentElement).fontSize);
    default: return val.v;
  }
}
const fromPx = (px: number, unit: string, el: HTMLElement, axis: 'x' | 'y') =>
  unit === 'px' ? px : px / (toPx({ v: 1, u: unit }, el, axis) || 1);

/** Convert `from` to the unit of `to` so the two can be tweened. */
function sameUnit(from: Val, toUnit: string, el: HTMLElement, axis: 'x' | 'y'): Val {
  if (from.u === toUnit || from.v === 0) return { v: from.v, u: toUnit };
  if (toUnit === 'deg' || from.u === 'deg') return { v: from.v, u: toUnit };
  return { v: fromPx(toPx(from, el, axis), toUnit, el, axis), u: toUnit };
}

function render(el: HTMLElement) {
  const s = state(el);
  if (s.hasTransform) {
    const f = (x: Val) => `${+x.v.toFixed(4)}${x.u.toUpperCase() === 'PX' ? 'PX' : x.u}`;
    el.style.transform = `translate3d(${f(s.tx)}, ${f(s.ty)}, ${f(s.tz)}) scale3d(${+s.sx.toFixed(4)}, ${+s.sy.toFixed(4)}, ${+s.sz.toFixed(4)}) rotateX(${f(s.rx)}) rotateY(${f(s.ry)}) rotateZ(${f(s.rz)}) skew(${f(s.skx)}, ${f(s.sky)})`;
    el.style.transformStyle = 'preserve-3d';
  }
  if (s.opacity !== undefined) el.style.opacity = String(+s.opacity.toFixed(4));
  if (s.width) el.style.width = s.width.u === 'auto' ? 'auto' : `${+s.width.v.toFixed(3)}${s.width.u}`;
  if (s.height) el.style.height = s.height.u === 'auto' ? 'auto' : `${+s.height.v.toFixed(3)}${s.height.u}`;
  if (s.filters && s.filters.size) {
    el.style.filter = [...s.filters].map(([k, v]) => `${k}(${+v.v.toFixed(3)}${v.u})`).join(' ');
  }
  const rgba = (c: number[]) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${+c[3].toFixed(3)})`;
  if (s.color) el.style.color = rgba(s.color);
  if (s.bg) el.style.backgroundColor = rgba(s.bg);
  if (s.border) el.style.borderColor = rgba(s.border);
}

// ---------------------------------------------------------------- one action item -> from/to "setter"

/** Returns a function that renders the item at progress t (0..1), or null for instant actions. */
function prepare(item: Obj, el: HTMLElement, base?: ElState, instant = false): ((t: number) => void) | null {
  const c = item.config;
  const s = state(el);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  switch (item.actionTypeId) {
    case 'TRANSFORM_MOVE':
    case 'TRANSFORM_ROTATE': {
      const isMove = item.actionTypeId === 'TRANSFORM_MOVE';
      const keys = isMove ? (['tx', 'ty', 'tz'] as const) : (['rx', 'ry', 'rz'] as const);
      const vals = [c.xValue, c.yValue, c.zValue];
      const units = [c.xUnit, c.yUnit, c.zUnit].map((u) => unitOf(u ?? (isMove ? 'px' : 'deg')));
      const plan = keys.map((k, i) => {
        if (vals[i] === undefined || vals[i] === null) return null;
        const from = sameUnit(s[k], units[i], el, i === 1 ? 'y' : 'x');
        return { k, from: from.v, to: vals[i] as number, u: units[i] };
      }).filter(Boolean) as { k: 'tx'; from: number; to: number; u: string }[];
      s.hasTransform = true;
      return (t) => { for (const p of plan) s[p.k] = { v: lerp(p.from, p.to, t), u: p.u }; render(el); };
    }
    case 'TRANSFORM_SCALE': {
      const from = [s.sx, s.sy, s.sz];
      const to = [c.xValue ?? from[0], c.yValue ?? from[1], c.zValue ?? from[2]];
      if (c.locked && c.xValue !== undefined) { to[1] = c.yValue ?? c.xValue; }
      s.hasTransform = true;
      return (t) => { s.sx = lerp(from[0], to[0], t); s.sy = lerp(from[1], to[1], t); s.sz = lerp(from[2], to[2], t); render(el); };
    }
    case 'STYLE_OPACITY': {
      const from = s.opacity ?? parseFloat(getComputedStyle(el).opacity);
      const to = c.value as number;
      return (t) => { s.opacity = lerp(from, to, t); render(el); };
    }
    case 'STYLE_SIZE': {
      const dims: ['width' | 'height', any, string | undefined, 'x' | 'y'][] = [
        ['width', c.widthValue, c.widthUnit, 'x'], ['height', c.heightValue, c.heightUnit, 'y']];
      const plan: { k: 'width' | 'height'; from: number; to: number; final: Val }[] = [];
      for (const [k, v, u, axis] of dims) {
        const unit = unitOf(u);
        if (unit === 'auto') {
          // measure the auto size, tween to it, then leave it as auto
          const cur = el.getBoundingClientRect()[k];
          const prev = el.style[k];
          el.style[k] = 'auto';
          const target = el.getBoundingClientRect()[k];
          el.style[k] = prev;
          plan.push({ k, from: cur, to: target, final: { v: 0, u: 'auto' } });
        } else if (v !== undefined && v !== null) {
          const cur = s[k] && s[k]!.u !== 'auto' ? toPx(s[k]!, el, axis) : el.getBoundingClientRect()[k];
          const target = toPx({ v, u: unit }, el.parentElement ?? el, axis);
          plan.push({ k, from: cur, to: target, final: { v, u: unit } });
        } else if (u && !instant) {
          // Webflow quirk: a unit with no value pins that side to the size
          // measured when the animation starts (the initial-state pass skips it).
          const cur = el.getBoundingClientRect()[k];
          plan.push({ k, from: cur, to: cur, final: { v: cur, u: 'px' } });
        }
      }
      return (t) => {
        for (const p of plan) s[p.k] = t >= 1 ? p.final : { v: lerp(p.from, p.to, t), u: 'px' };
        render(el);
      };
    }
    case 'STYLE_FILTER': {
      const cur = readFilters(el);
      const plan = (c.filters as Obj[]).map((f) => ({ type: f.type as string, from: cur.get(f.type)?.v ?? (['brightness', 'contrast', 'saturate', 'opacity'].includes(f.type) ? 100 : 0), to: f.value as number, u: (f.unit as string) || '' }));
      return (t) => { for (const p of plan) cur.set(p.type, { v: lerp(p.from, p.to, t), u: p.u }); render(el); };
    }
    case 'STYLE_TEXT_COLOR':
    case 'STYLE_BACKGROUND_COLOR':
    case 'STYLE_BORDER': {
      const key = item.actionTypeId === 'STYLE_TEXT_COLOR' ? 'color' : item.actionTypeId === 'STYLE_BORDER' ? 'border' : 'bg';
      const from = [...readColor(el, key)];
      const to = [c.rValue ?? from[0], c.gValue ?? from[1], c.bValue ?? from[2], c.aValue ?? from[3]];
      return (t) => { s[key] = from.map((f, i) => lerp(f, to[i], t)); render(el); };
    }
    case 'GENERAL_DISPLAY':
      el.style.display = c.value;
      return null;
  }
  void base;
  return null;
}

// ---------------------------------------------------------------- target lookup

const pageId = document.documentElement.getAttribute('data-wf-page') ?? '';

function byWid(id: string, scope: ParentNode = document): HTMLElement[] {
  let wid = id;
  if (id.includes('|')) {
    const [page, w] = id.split('|');
    if (page !== pageId) return [];
    wid = w;
  }
  return [...scope.querySelectorAll<HTMLElement>(`[data-w-id="${wid}"]`)];
}

function resolveTargets(target: Obj, eventEl: HTMLElement | null): HTMLElement[] {
  const ev = eventEl ?? document.body;
  const mode = target.useEventTarget;
  if (mode === true || target.appliesTo === 'TRIGGER_ELEMENT') {
    return eventEl ? [eventEl] : byWid(target.id ?? '');
  }
  if (target.id) {
    if (mode === 'CHILDREN') return byWid(target.id, ev);
    return byWid(target.id);
  }
  if (target.selector) {
    const sel = target.selector as string;
    if (mode === 'CHILDREN') return [...ev.querySelectorAll<HTMLElement>(sel)];
    if (mode === 'SIBLINGS') {
      const parent = ev.parentElement;
      return parent ? [...parent.children].filter((c): c is HTMLElement => c !== ev && c.matches(sel)) as HTMLElement[] : [];
    }
    if (mode === 'PARENT') {
      const p = ev.parentElement?.closest<HTMLElement>(sel);
      return p ? [p] : [];
    }
    return [...document.querySelectorAll<HTMLElement>(sel)];
  }
  return [];
}

// ---------------------------------------------------------------- tweening

interface Tween { cancel(): void }
const running = new WeakMap<HTMLElement, Map<string, Tween>>();
const propKey = (type: string) => (type === 'TRANSFORM_MOVE' ? 'move' : type === 'TRANSFORM_SCALE' ? 'scale' : type === 'TRANSFORM_ROTATE' ? 'rotate' : type);

function tween(el: HTMLElement, item: Obj, instant: boolean): Tween | null {
  const key = propKey(item.actionTypeId);
  let map = running.get(el);
  if (!map) running.set(el, (map = new Map()));
  map.get(key)?.cancel();
  const set = prepare(item, el, undefined, instant);
  if (!set) return null;
  const dur = item.config.duration ?? 0;
  if (instant || dur <= 0) { set(1); return null; }
  const e = ease(item.config.easing);
  const start = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    set(e(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else map!.delete(key);
  };
  raf = requestAnimationFrame(step);
  const tw = { cancel: () => cancelAnimationFrame(raf) };
  map.set(key, tw);
  return tw;
}

// ---------------------------------------------------------------- action lists

class Playback {
  private timers: number[] = [];
  private tweens: Tween[] = [];
  stopped = false;
  constructor(private list: Obj, private eventEl: HTMLElement | null, private loop: boolean) {}

  start() {
    const groups: Obj[] = this.list.actionItemGroups ?? [];
    let i = 0;
    if (this.list.useFirstGroupAsInitialState && groups.length) {
      this.runGroup(groups[0], true);
      i = 1;
    }
    this.next(groups, i);
  }

  private next(groups: Obj[], i: number) {
    if (this.stopped) return;
    if (i >= groups.length) {
      if (this.loop && groups.length) this.timers.push(window.setTimeout(() => this.start(), 0));
      return;
    }
    const total = this.runGroup(groups[i], false);
    this.timers.push(window.setTimeout(() => this.next(groups, i + 1), total));
  }

  private runGroup(group: Obj, instant: boolean): number {
    let total = 0;
    for (const item of group.actionItems as Obj[]) {
      const delay = instant ? 0 : item.config.delay ?? 0;
      total = Math.max(total, delay + (item.config.duration ?? 0));
      const els = resolveTargets(item.config.target ?? {}, this.eventEl);
      const go = () => {
        if (this.stopped) return;
        for (const el of els) {
          try {
            const tw = tween(el, item, instant);
            if (tw) this.tweens.push(tw);
          } catch (err) {
            console.warn('interaction item skipped', item.actionTypeId, err);
          }
        }
      };
      if (delay > 0) this.timers.push(window.setTimeout(go, delay));
      else go();
    }
    return instant ? 0 : total;
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.tweens.forEach((t) => t.cancel());
  }
}

// ---------------------------------------------------------------- continuous (scroll / mouse) animations

interface Track { type: string; target: Obj; frames: { k: number; item: Obj }[] }

function buildTracks(group: Obj): Track[] {
  const tracks = new Map<string, Track>();
  for (const kf of group.continuousActionGroups as Obj[]) {
    for (const item of kf.actionItems as Obj[]) {
      const target = item.config.target ?? {};
      const key = item.actionTypeId + JSON.stringify(target);
      let tr = tracks.get(key);
      if (!tr) tracks.set(key, (tr = { type: item.actionTypeId, target, frames: [] }));
      tr.frames.push({ k: kf.keyframe, item });
    }
  }
  for (const tr of tracks.values()) tr.frames.sort((a, b) => a.k - b.k);
  return [...tracks.values()];
}

/** Value of one numeric field along a track at progress p (0..100). */
function applyTrack(tr: Track, p: number, eventEl: HTMLElement) {
  const f = tr.frames;
  let a = f[0], b = f[f.length - 1];
  for (let i = 0; i < f.length - 1; i++) {
    if (p >= f[i].k && p <= f[i + 1].k) { a = f[i]; b = f[i + 1]; break; }
  }
  let t = 0;
  if (p <= f[0].k) { a = b = f[0]; } else if (p >= f[f.length - 1].k) { a = b = f[f.length - 1]; } else {
    t = b.k === a.k ? 1 : (p - a.k) / (b.k - a.k);
    t = ease(b.item.config.easing)(t);
  }
  const mix = (x?: number, y?: number) => (x === undefined || x === null ? y : y === undefined || y === null ? x : x + (y - x) * t);
  const ca = a.item.config, cb = b.item.config;
  const config: Obj = { ...cb, duration: 0, delay: 0 };
  for (const k of ['xValue', 'yValue', 'zValue', 'value', 'widthValue', 'heightValue', 'rValue', 'gValue', 'bValue', 'aValue']) {
    if (ca[k] !== undefined || cb[k] !== undefined) config[k] = mix(ca[k], cb[k]);
  }
  if (cb.filters) {
    config.filters = (cb.filters as Obj[]).map((fb, i) => ({ ...fb, value: mix(ca.filters?.[i]?.value, fb.value) }));
  }
  for (const el of resolveTargets(tr.target, eventEl)) {
    const set = prepare({ actionTypeId: tr.type, config }, el);
    set?.(1);
  }
}

interface Continuous { event: Obj; el: HTMLElement; groups: { cfg: Obj; tracks: Track[]; cur: number; target: number }[] }
const continuous: Continuous[] = [];

function scrollProgress(el: HTMLElement, cfg: Obj): number {
  // Port of Webflow IX2's SCROLLING_IN_VIEW handler (element-based).
  const d = el.getBoundingClientRect();
  const u = document.documentElement.clientHeight;
  const sh = document.documentElement.scrollHeight;
  let o = (cfg.addStartOffset ? cfg.addOffsetValue ?? 0 : 0) / 100;
  let c = (cfg.addEndOffset ? cfg.endOffsetValue ?? 0 : 0) / 100;
  o = cfg.startsEntering ? o : 1 - o;
  c = cfg.startsExiting ? c : 1 - c;
  const r = d.top + Math.min(d.height * o, u);
  const f = Math.min(u + (d.top + d.height * c - r), sh);
  if (f <= 0) return 0;
  return (Math.min(Math.max(0, u - r), f) / f) * 100;
}

const mouse = { x: -1, y: -1 };
let mouseMoved = false;

function tickContinuous() {
  const bp = breakpoint();
  for (const c of continuous) {
    if (!c.event.mediaQueries.includes(bp)) continue;
    for (const g of c.groups) {
      if (c.event.eventTypeId === 'SCROLLING_IN_VIEW') {
        g.target = scrollProgress(c.el, g.cfg);
      } else if (mouseMoved) {
        const r = c.el.getBoundingClientRect();
        const inside = mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
        if (!inside) g.target = g.cfg.restingState ?? 0;
        else {
          const v = g.cfg.selectedAxis === 'Y_AXIS' ? (mouse.y - r.top) / r.height : (mouse.x - r.left) / r.width;
          g.target = (g.cfg.reverse ? 1 - v : v) * 100;
        }
      }
      const smooth = Math.min(0.99, Math.max(0, (g.cfg.smoothing ?? 0) / 100));
      const prev = g.cur;
      g.cur = Number.isNaN(g.cur) ? g.target : g.cur + (g.target - g.cur) * (1 - smooth);
      if (Math.abs(g.cur - g.target) < 0.01) g.cur = g.target;
      if (g.cur !== prev) for (const tr of g.tracks) applyTrack(tr, g.cur, c.el);
    }
  }
  requestAnimationFrame(tickContinuous);
}

// ---------------------------------------------------------------- events

// Webflow's built-in "slide" presets, copied from its runtime. Events that use
// them name the preset as their action list.
const presetMove = (id: string, x: number, y: number, extra: Obj = {}) => ({
  id, actionTypeId: 'TRANSFORM_MOVE',
  config: { delay: 0, easing: 'outQuart', duration: 0, target: { id: 'N/A', appliesTo: 'TRIGGER_ELEMENT', useEventTarget: true }, xValue: x, yValue: y, xUnit: 'PX', yUnit: 'PX', zUnit: 'PX', ...extra },
});
const presetFade = (id: string, value: number, extra: Obj = {}) => ({
  id, actionTypeId: 'STYLE_OPACITY',
  config: { delay: 0, easing: 'outQuart', duration: 0, target: { id: 'N/A', appliesTo: 'TRIGGER_ELEMENT', useEventTarget: true }, value, ...extra },
});
const slideIn = (id: string, x: number, y: number) => ({
  id, useFirstGroupAsInitialState: true,
  actionItemGroups: [
    { actionItems: [presetFade(`${id}-1`, 0)] },
    { actionItems: [presetMove(`${id}-2`, x, y)] },
    { actionItems: [presetFade(`${id}-3`, 1, { duration: 1000 }), presetMove(`${id}-4`, 0, 0, { duration: 1000 })] },
  ],
});
const PRESET_LISTS: Obj = {
  slideInRight: slideIn('slideInRight', 100, 0),
  slideInBottom: slideIn('slideInBottom', 0, 100),
  slideOutLeft: {
    id: 'slideOutLeft',
    actionItemGroups: [{ actionItems: [
      presetFade('slideOutLeft-1', 0, { easing: 'inQuart', duration: 1000 }),
      presetMove('slideOutLeft-2', -100, 0, { easing: 'inQuart', duration: 1000 }),
    ] }],
  },
};
const PLAYABLE = new Set(['GENERAL_START_ACTION', 'SLIDE_EFFECT']);

export function initInteractions(data: Obj) {
  const lists: Obj = { ...PRESET_LISTS, ...data.actionLists };
  const playbacks = new Map<string, Map<HTMLElement | null, Playback>>(); // eventId -> el -> playback

  const eventElements = (ev: Obj): (HTMLElement | null)[] => {
    const t = ev.target;
    if (t.appliesTo === 'PAGE') return t.id === pageId ? [null] : [];
    if (t.appliesTo === 'CLASS' && t.selector) return [...document.querySelectorAll<HTMLElement>(t.selector)];
    return t.id ? byWid(t.id) : [];
  };

  const fire = (ev: Obj, el: HTMLElement | null) => {
    if (!ev.mediaQueries.includes(breakpoint())) return;
    const action = ev.action;
    if (!PLAYABLE.has(action.actionTypeId)) return;
    const list = lists[action.config.actionListId];
    if (!list) return;
    const stopId = action.config.autoStopEventId;
    // Webflow pairs PAGE_START with PAGE_FINISH via autoStopEventId. Letting the
    // finish event stop the start one cuts the intro short when the page loads
    // fast (live, the CDN is slow enough that the intro always finishes first).
    const pageEvent = ev.eventTypeId === 'PAGE_START' || ev.eventTypeId === 'PAGE_FINISH';
    if (stopId && !pageEvent) playbacks.get(stopId)?.get(el)?.stop();
    let m = playbacks.get(ev.id);
    if (!m) playbacks.set(ev.id, (m = new Map()));
    m.get(el)?.stop();
    const pb = new Playback(list, el, Boolean(ev.config?.loop));
    m.set(el, pb);
    pb.start();
  };

  const events = Object.values(data.events as Obj);
  const bp = breakpoint();

  // initial states (the first action group of lists marked "set as initial state")
  for (const ev of events) {
    if (!ev.mediaQueries.includes(bp) || !PLAYABLE.has(ev.action?.actionTypeId)) continue;
    const list = lists[ev.action.config.actionListId];
    if (!list?.useFirstGroupAsInitialState || !list.actionItemGroups?.length) continue;
    for (const el of eventElements(ev)) {
      for (const item of list.actionItemGroups[0].actionItems) {
        for (const t of resolveTargets(item.config.target ?? {}, el)) tween(t, item, true);
      }
    }
  }

  const clickHandlers = new Map<HTMLElement, { first: Obj[]; second: Obj[]; count: number }>();
  const scrollWatches: { ev: Obj; el: HTMLElement; visible?: boolean; triggered?: boolean }[] = [];

  for (const ev of events) {
    const els = eventElements(ev);
    switch (ev.eventTypeId) {
      case 'MOUSE_OVER':
        els.forEach((el) => el?.addEventListener('mouseenter', () => fire(ev, el)));
        break;
      case 'MOUSE_OUT':
        els.forEach((el) => el?.addEventListener('mouseleave', () => fire(ev, el)));
        break;
      case 'MOUSE_CLICK':
      case 'MOUSE_SECOND_CLICK':
        for (const el of els) {
          if (!el) continue;
          let h = clickHandlers.get(el);
          if (!h) {
            const handler = (h = { first: [], second: [], count: 0 });
            clickHandlers.set(el, handler);
            el.addEventListener('click', () => {
              handler.count++;
              const useSecond = handler.count % 2 === 0 && handler.second.length > 0;
              (useSecond ? handler.second : handler.first).forEach((e) => fire(e, el));
            });
          }
          (ev.eventTypeId === 'MOUSE_CLICK' ? h.first : h.second).push(ev);
        }
        break;
      case 'PAGE_START':
        els.forEach((el) => fire(ev, el));
        break;
      case 'PAGE_FINISH':
        if (document.readyState === 'complete') els.forEach((el) => fire(ev, el));
        else window.addEventListener('load', () => els.forEach((el) => fire(ev, el)));
        break;
      case 'SCROLL_INTO_VIEW':
      case 'SCROLL_OUT_OF_VIEW':
        for (const el of els) if (el) scrollWatches.push({ ev, el });
        break;
      case 'SCROLLING_IN_VIEW':
      case 'MOUSE_MOVE': {
        const cfgs: Obj[] = Array.isArray(ev.config) ? ev.config : [];
        const list = lists[ev.action?.config?.actionListId];
        if (!list?.continuousParameterGroups) break;
        for (const el of els) {
          if (!el) continue;
          const groups = cfgs.map((cfg) => {
            const g = list.continuousParameterGroups.find((x: Obj) => x.id === cfg.continuousParameterGroupId);
            // Webflow starts a mouse-move animation at its resting state.
            return g ? { cfg, tracks: buildTracks(g), cur: NaN, target: cfg.restingState ?? 0 } : null;
          }).filter(Boolean) as Continuous['groups'];
          continuous.push({ event: ev, el, groups });
        }
        break;
      }
    }
  }

  // Scroll into / out of view, following Webflow's runtime: each event keeps
  // its own visible flag, the offset trims both the top and bottom of the
  // viewport, "into" also fires on load if already visible, and an event
  // whose paired stop event doesn't exist only ever plays once.
  const checkScroll = () => {
    const { clientWidth: w, clientHeight: h } = document.documentElement;
    const now = breakpoint();
    for (const s of scrollWatches) {
      if (!s.ev.mediaQueries.includes(now)) continue;
      if (s.triggered && !data.events[s.ev.action?.config?.autoStopEventId]) continue;
      const c = s.ev.config ?? {};
      const off = c.scrollOffsetUnit === 'PX' ? (c.scrollOffsetValue ?? 0) : (h * (c.scrollOffsetValue || 0)) / 100;
      const r = s.el.getBoundingClientRect();
      const visible = !(r.left > w || r.right < 0 || r.top > h - off || r.bottom < off);
      const changed = s.visible === undefined ? visible : visible !== s.visible;
      s.visible = visible;
      if (changed && (s.ev.eventTypeId === 'SCROLL_INTO_VIEW') === visible) {
        s.triggered = true;
        fire(s.ev, s.el);
      }
    }
  };
  if (scrollWatches.length) {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; checkScroll(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    checkScroll();
  }

  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouseMoved = true; }, { passive: true });
  if (continuous.length) requestAnimationFrame(tickContinuous);
  document.documentElement.classList.add('w-mod-ix');
}
