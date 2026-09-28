/* ============================================================
   SCROLL MOTION
   Things grow into place as they scroll into view, like drops of glass
   spreading out. Each .animate-on-scroll element starts smaller, softly
   blurred and see-through, then swells to its real size on a spring with a
   small overshoot. Width settles a beat ahead of height, so it reads as
   liquid rather than a rigid zoom.

   How it fits together
   - scroll-motion.css keeps elements at opacity 0 until they're revealed
     (plus a failsafe that shows them anyway if this file never runs).
   - Here an IntersectionObserver notices them, a damped spring is sampled
     into Web Animations keyframes, and .visible goes on as each one starts.
     Transform and opacity animate together on the compositor. The blur (and
     the skill cards' droplet corners) run as their own short animations, so
     they can't pull the growth off the compositor. Nothing is left behind
     when an animation ends, so hover effects (they use the separate `scale`
     and `translate` properties) and the project cards' tilt work straight
     away, even mid-entrance.
   - Things that arrive together cascade in reading order. A lone element
     never waits. Skill chips, stat cards, contact links and buttons grow in
     one after another once their container starts.
   - The hero waits for the black-hole intro to start dissolving, or goes
     right away when the intro was skipped.
   - Reduced motion: a quick fade, with no growth, blur or stagger.
   ============================================================ */

(() => {
    'use strict';

    const SELECTOR = '.animate-on-scroll';

    // ---------- Timing ----------
    const STEP = 75;              // ms between things that arrive together
    const MIN_STEP = 30;
    const SPREAD = 480;           // a big batch's cascade is squeezed to fit in this
    const MAX_LAG = 600;          // nothing waits longer than this for its turn
    const LEAD = 24;              // animations are created this many ms before their turn
    const CHIP_CAP = 80;          // most chips growing at once (the whole skills grid); past it, they arrive with their card
    const CHIP_BLUR_CAP = 24;     // most chips blurring at once: the blur runs on the main thread, the growth doesn't
    const HERO_AFTER_INTRO = 380; // ms after the intro overlay starts fading
    const HERO_SKIPPED = 120;     // ms after load when there was no intro
    const HERO_DELAY_SCALE = 0.8; // the hero keeps its data-delay sequence, a little tighter
    const FIXED_AFTER_HERO = 1100; // fixed-position extras (the Konami hint) come in after the hero
    const FRAME = 1000 / 90;      // spring sample spacing at the start, ms; it widens as the spring settles
    const FRAME_MAX = 48;         // widest sample spacing, ms (keyframe count is what el.animate() pays for)
    const EPS = 0.0012;           // scale error at which a spring counts as settled
    const FAILSAFE_MS = 2500;     // the failsafe's animation-delay in scroll-motion.css

    // ---------- Springs ----------
    // Apple's two knobs: damping ratio (1 = no overshoot, lower = more) and response (about how
    // many seconds it takes to get there). Unit mass, starting at rest, going from 0 to 1.
    function spring(zeta, response) {
        const w0 = (2 * Math.PI) / response;
        if (zeta >= 1) return (t) => 1 - (1 + w0 * t) * Math.exp(-w0 * t);
        const k = zeta * w0;
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        return (t) => 1 - Math.exp(-k * t) * (Math.cos(wd * t) + (k / wd) * Math.sin(wd * t));
    }

    // Seconds until the spring stays within eps (a fraction of the distance) of its target
    function settleTime(zeta, response, eps) {
        const w0 = (2 * Math.PI) / response;
        if (zeta < 1) return Math.log(1 / (eps * Math.sqrt(1 - zeta * zeta))) / (zeta * w0);
        let t = 0;
        while ((1 + w0 * t) * Math.exp(-w0 * t) > eps) t += 0.004;
        return t;
    }

    // ---------- Motion kinds ----------
    // zeta/response drive the width; the height uses response * lag, so it trails a touch.
    // Start size is fixed (sx, sy) or comes from the element's size, so big blocks move about
    // as far at their edges as small ones: 1 - reach / longest side, clamped to min..max, with
    // the height squashed `aspect` times more than the width. blur is the starting radius in px.
    const KINDS = {
        droplet: { zeta: 0.68, response: 0.6, lag: 1.16, sx: 0.62, sy: 0.48, blur: 8, pill: true },
        orb: { zeta: 0.62, response: 0.58, lag: 1.14, sx: 0.55, sy: 0.55, blur: 6 },
        card: { zeta: 0.66, response: 0.55, lag: 1.12, reach: 60, min: 0.84, max: 0.95, aspect: 1.15, blur: 6 },
        tile: { zeta: 0.64, response: 0.5, lag: 1.12, sx: 0.8, sy: 0.76, blur: 4 },
        pill: { zeta: 0.62, response: 0.46, lag: 1.14, sx: 0.62, sy: 0.52, blur: 3 },
        chip: { zeta: 0.6, response: 0.4, lag: 1.14, sx: 0.46, sy: 0.36, blur: 3 },
        heading: { zeta: 0.8, response: 0.6, lag: 1.08, reach: 44, min: 0.92, max: 0.97, aspect: 1.1, blur: 3 },
        text: { zeta: 0.84, response: 0.55, lag: 1.06, reach: 36, min: 0.95, max: 0.975, aspect: 1.1, blur: 3 },
        media: { zeta: 0.9, response: 0.75, lag: 1.05, reach: 40, min: 0.95, max: 0.975, aspect: 1, blur: 0 },
    };

    // Which kind each element gets, read from the classes already in the markup (first match wins)
    const KIND_RULES = [
        ['droplet', '.skill-category'],
        ['orb', '.hero-profile-wrapper'],
        ['media', '.hero-right, .resume-preview-container'],
        ['heading', '.section-label, .section-headline, .hero-name, .contact-headline, .resume-header, h1, h2'],
        ['card', '.project-card, .award-card, .edu-card, .gallery-item, .timeline-item, .status-box, '
            + '.recommendations-section, .languages-section, .easter-egg-hint, [data-animation="scale-up"], '
            + '[data-animation="zoom-in"], [data-animation="float-in"], [data-animation^="slide"]'],
    ];
    const kindOf = (el) => (KIND_RULES.find(([, sel]) => el.matches(sel)) || ['text'])[0];

    // Containers whose children grow in one after another once the container starts.
    // bare: the container itself just appears and its children do all the growing.
    // start: ms after the container before the first child; step: ms between children,
    // squeezed so the whole run never takes longer than spread.
    const CASCADES = [
        { parent: '.skill-category', child: '.skill-tag', kind: 'chip', start: 170, step: 30, spread: 300 },
        { parent: '.timeline-item', child: '.timeline-tags > .tag', kind: 'chip', start: 240, step: 40, spread: 200 },
        { parent: '.about-stats', child: '.stat-card', kind: 'tile', start: 0, step: 60, spread: 300, bare: true },
        { parent: '.contact-links', child: '.contact-link', kind: 'tile', start: 0, step: 80, spread: 240, bare: true },
        { parent: '.hero-cta, .contact-cta, .certifications-cta', child: '.btn', kind: 'pill', start: 0, step: 90, spread: 180, bare: true },
    ];

    // ---------- State ----------
    const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
    const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Cached rather than read on every reveal, the same way script.js does it: reading .matches
    // very often can make Chrome skip the change event
    let reduced = !!(reducedQuery && reducedQuery.matches);

    const observed = new WeakSet();  // handed to an IntersectionObserver
    const gated = new WeakSet();     // waits for the intro (hero, fixed-position extras)
    const fixedEls = new WeakSet();
    const held = new Set();          // gated elements that came into view before the intro ended
    const active = new Set();        // running reveal animations
    const pending = new Set();       // observe() requests waiting for the next microtask
    const running = { chip: 0, chipBlur: 0 }; // live chip animations, for the caps above
    let lastStart = -Infinity;       // when the most recently scheduled reveal starts (cascade clock)
    let gateOpen = false;
    let gateAt = 0;
    let gateOffset = 0;
    let introOverlay = null;
    let started = false;
    let flushQueued = false;
    let io = null;
    let ioFixed = null;

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function onReducedChange(e) {
        reduced = e.matches;
        // Switched on mid-entrance: land everything now instead of finishing the motion
        if (reduced) active.forEach((anim) => { try { anim.finish(); } catch (_) { /* already done */ } });
    }
    if (reducedQuery) {
        if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', onReducedChange);
        else if (reducedQuery.addListener) reducedQuery.addListener(onReducedChange);
    }

    // ---------- Keyframes ----------
    // Samples the springs densely at the start, where they move fastest, and more sparsely as
    // they settle. Growth (transform + opacity) runs until both scale springs settle, ending
    // exactly at identity. The blur and the corners stop as soon as they've settled, so their
    // main-thread work is short.
    function sampleTimes(secs) {
        const times = [];
        for (let t = 0; t < secs - 0.004; t += Math.min(FRAME_MAX, FRAME * (1 + 4 * t)) / 1000) times.push(t);
        times.push(secs);
        return times;
    }

    function sampleGrowth(k, sx0, sy0, blur, opacity, base, radius) {
        const X = spring(k.zeta, k.response);
        const Y = spring(k.zeta, k.response * k.lag);
        const fade = spring(1, k.response * 0.45);
        const clear = spring(1, k.response * k.lag * 0.6);
        const round = spring(1, k.response * k.lag * 0.85);
        const secs = Math.max(0.35,
            settleTime(k.zeta, k.response, EPS / Math.max(EPS, 1 - sx0)),
            settleTime(k.zeta, k.response * k.lag, EPS / Math.max(EPS, 1 - sy0)));
        const times = sampleTimes(secs);
        const grow = [];
        const soften = [];
        const corners = [];
        let blurDone = !blur;
        let roundDone = !radius;
        let blurSecs = 0;
        let roundSecs = 0;

        times.forEach((t, i) => {
            const end = i === times.length - 1;
            const sx = end ? 1 : sx0 + (1 - sx0) * X(t);
            const sy = end ? 1 : sy0 + (1 - sy0) * Y(t);
            grow.push({
                offset: t / secs,
                transform: `${base}scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
                opacity: end ? opacity : Math.round(opacity * Math.min(1, fade(t)) * 1000) / 1000,
            });
            if (!blurDone) {
                const b = blur * (1 - clear(t));
                blurDone = end || b < 0.05;
                blurSecs = t;
                soften.push({ offset: t, filter: `blur(${blurDone ? 0 : b.toFixed(2)}px)` });
            }
            if (!roundDone) {
                // The radius eases from pill to the card's own on screen; dividing by each axis'
                // scale keeps the corners circular while width and height grow at different rates
                const r = radius.to + (radius.from - radius.to) * (1 - round(t));
                roundDone = end || r - radius.to < 0.25;
                roundSecs = t;
                corners.push({
                    offset: t,
                    borderRadius: roundDone
                        ? `${radius.to}px`
                        : `${(r / sx).toFixed(1)}px / ${(r / sy).toFixed(1)}px`,
                });
            }
        });
        // The shorter tracks end early: their offsets are fractions of their own length
        const rescale = (frames, len) => frames.forEach((f) => { f.offset = len ? f.offset / len : 0; });
        rescale(soften, blurSecs);
        rescale(corners, roundSecs);
        const ms = (s) => Math.max(1, Math.round(s * 1000));
        return { grow, growMs: ms(secs), soften, softenMs: ms(blurSecs), corners, cornersMs: ms(roundSecs) };
    }

    // ---------- Reading an element ----------
    function alignX(cs) {
        let align = cs.textAlign;
        const rtl = cs.direction === 'rtl';
        if (align === 'start') align = rtl ? 'right' : 'left';
        if (align === 'end') align = rtl ? 'left' : 'right';
        return align === 'center' ? '50%' : align === 'right' ? '100%' : '0%';
    }

    function originFor(el, kind, cs) {
        // Timeline entries grow out of their dot on the line
        const marker = el.matches('.timeline-item') && el.querySelector('.timeline-marker');
        if (marker) {
            const box = el.getBoundingClientRect();
            const dot = marker.getBoundingClientRect();
            return `${(dot.left + dot.width / 2 - box.left).toFixed(1)}px ${(dot.top + dot.height / 2 - box.top).toFixed(1)}px`;
        }
        // Headlines and text grow from where their lines start
        if (kind === 'heading' || kind === 'text') return `${alignX(cs)} 0%`;
        return ''; // cards: the default centre
    }

    function uniformRadius(cs) {
        const r = cs.borderTopLeftRadius;
        const same = r === cs.borderTopRightRadius && r === cs.borderBottomLeftRadius && r === cs.borderBottomRightRadius;
        return same && /^[\d.]+px$/.test(r) ? parseFloat(r) : null;
    }

    const cascadeFor = (el) => CASCADES.find((c) => el.matches(c.parent));

    function planFor(el, rect) {
        const kind = kindOf(el);
        const k = KINDS[kind];
        const cs = getComputedStyle(el);
        const c = cascadeFor(el);
        const bare = !!(c && c.bare && el.querySelector(c.child));
        const w = rect.width;
        const h = rect.height;
        let sx0 = k.sx;
        let sy0 = k.sy;
        if (!sx0) {
            sx0 = clamp(1 - k.reach / Math.max(w, h, 1), k.min, k.max);
            sy0 = 1 - (1 - sx0) * k.aspect;
        }
        // Blur only small things that have no filter of their own: it's the costliest part
        const area = (w * h) / Math.max(1, window.innerWidth * window.innerHeight);
        const blur = cs.filter !== 'none' || area > 0.35 ? 0 : k.blur;
        const opacity = parseFloat(cs.opacity);
        let radius = null;
        if (k.pill) {
            const to = uniformRadius(cs);
            if (to !== null) radius = { from: Math.min(w * sx0, h * sy0) / 2, to };
        }
        return {
            k,
            sx0,
            sy0,
            blur,
            radius,
            cascade: c,
            bare,
            base: cs.transform && cs.transform !== 'none' ? `${cs.transform} ` : '',
            opacity: Number.isFinite(opacity) ? opacity : 1,
            origin: bare ? '' : originFor(el, kind, cs),
            originBefore: '',
        };
    }

    function restoreOrigin(el, p) {
        el.style.transformOrigin = p.originBefore;
        if (!el.getAttribute('style')) el.removeAttribute('style');
    }

    // ---------- Starting animations ----------
    function track(anim, onDone, counter) {
        active.add(anim);
        if (counter) running[counter]++;
        let done = false;
        const end = () => {
            if (done) return;
            done = true;
            active.delete(anim);
            if (counter) running[counter]--;
            if (onDone) onDone();
        };
        anim.addEventListener('finish', end);
        anim.addEventListener('cancel', end);
        return anim;
    }

    function start(el, p, delay, isChip) {
        const s = sampleGrowth(p.k, p.sx0, p.sy0, p.blur, p.opacity, p.base, p.radius);
        const timing = (duration) => ({ duration, delay: Math.max(0, Math.round(delay)), fill: 'backwards', easing: 'linear' });
        // The origin was put in place by reveal(); it goes once the growth is over
        track(el.animate(s.grow, timing(s.growMs)), p.origin ? () => restoreOrigin(el, p) : null, isChip ? 'chip' : null);
        if (s.soften.length > 1) track(el.animate(s.soften, timing(s.softenMs)), null, isChip ? 'chipBlur' : null);
        if (s.corners.length > 1) track(el.animate(s.corners, timing(s.cornersMs)));
    }

    function cascade(el, c, delay) {
        const kids = el.querySelectorAll(c.child);
        if (!kids.length) return;
        const chips = c.kind === 'chip';
        // Far too many chips already in flight: these arrive with their card instead
        if (chips && running.chip + kids.length > CHIP_CAP) return;
        const k = KINDS[c.kind];
        // Past the blur budget they still grow, just without the (main-thread) blur
        const blur = chips && running.chipBlur + kids.length > CHIP_BLUR_CAP ? 0 : k.blur;
        const step = kids.length > 1 ? Math.min(c.step, c.spread / (kids.length - 1)) : 0;
        const plan = { k, sx0: k.sx, sy0: k.sy, blur, radius: null, base: '', opacity: 1, origin: '' };
        kids.forEach((kid, i) => start(kid, plan, delay + c.start + i * step, chips));
    }

    function launch(el, plan, delay) {
        if (!plan.bare) start(el, plan, delay, false);
        if (plan.cascade) cascade(el, plan.cascade, delay);
    }

    function fadeIn(el) {
        try {
            track(el.animate([{ opacity: 0, offset: 0 }], { duration: 220, easing: 'ease-out', fill: 'backwards' }));
        } catch (_) { /* no implicit keyframes: it simply appears */ }
    }

    // ---------- Revealing ----------
    function heroWait(now, el) {
        const extra = fixedEls.has(el)
            ? FIXED_AFTER_HERO
            : Math.round((parseInt(el.dataset.delay, 10) || 0) * HERO_DELAY_SCALE);
        return Math.max(0, gateAt + gateOffset - now) + extra;
    }

    // Rows first, then left to right, so a grid fills in as a wave
    const readingOrder = (a, b) => (Math.round(a.rect.top / 24) - Math.round(b.rect.top / 24)) || (a.rect.left - b.rect.left);

    // Picks when each element starts, then sets each one going at its turn: creating the
    // animations for a whole grid (and its chips) in one go would cost a frame. Until then the
    // CSS waiting state keeps it hidden.
    function run(batch) {
        const now = performance.now();
        batch.sort(readingOrder);
        const step = clamp(SPREAD / Math.max(1, batch.length - 1), MIN_STEP, STEP);
        const turns = new Map();
        for (const item of batch) {
            if (reduced) {
                item.at = now;
            } else if (gated.has(item.el)) {
                item.at = now + heroWait(now, item.el);
            } else {
                item.at = clamp(lastStart + step, now, now + MAX_LAG);
                lastStart = item.at;
            }
            const due = Math.max(0, Math.round(item.at - now - LEAD));
            if (!turns.has(due)) turns.set(due, []);
            turns.get(due).push(item);
        }
        turns.forEach((items, due) => {
            if (due < FRAME) reveal(items);
            else setTimeout(() => reveal(items), due);
        });
    }

    function reveal(items) {
        const batch = items.filter(({ el }) => !el.classList.contains('visible'));
        if (!batch.length) return;
        const now = performance.now();
        batch.forEach((item) => { item.delay = reduced ? 0 : Math.max(0, item.at - now); });
        // Mark them, read styles, then start animating: nothing gets painted in between, and
        // the animations hold their start state through the lead-in, so .visible never shows
        // anything early. Transitions are held off while .visible and the growth origin go on;
        // otherwise a `transition: all` rule would fade the opacity underneath (so the natural
        // opacity would read as 0) and slide the origin.
        const inline = batch.map(({ el }) => {
            const before = el.style.transition;
            el.style.transition = 'none';
            el.classList.add('visible');
            return before;
        });
        const plans = batch.map((item) => {
            try {
                if (reduced || !canAnimate) return void getComputedStyle(item.el).opacity; // settle the style
                const p = planFor(item.el, item.rect);
                if (p.origin) {
                    p.originBefore = item.el.style.transformOrigin;
                    item.el.style.transformOrigin = p.origin;
                    void getComputedStyle(item.el).transformOrigin; // applied while transitions are off
                }
                return p;
            } catch (_) { return null; }
        });
        batch.forEach(({ el }, i) => {
            el.style.transition = inline[i];
            if (!el.getAttribute('style')) el.removeAttribute('style');
        });
        if (!canAnimate) return;
        if (reduced) {
            batch.forEach(({ el }) => fadeIn(el));
            return;
        }
        batch.forEach((item, i) => {
            const p = plans[i];
            if (!p) return;
            try {
                launch(item.el, p, item.delay);
            } catch (_) {
                if (p.origin) restoreOrigin(item.el, p); // it's already visible, just not animated
            }
        });
    }

    function onIntersect(entries) {
        const batch = [];
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target;
            io.unobserve(el);
            ioFixed.unobserve(el);
            if (el.classList.contains('visible')) continue;
            if (gated.has(el) && !gateOpen) {
                held.add(el);
                continue;
            }
            batch.push({ el, rect: entry.boundingClientRect });
        }
        if (batch.length) run(batch);
    }

    function observe(el) {
        if (observed.has(el) || el.classList.contains('visible') || !el.isConnected) return;
        observed.add(el);
        const fixed = getComputedStyle(el).position === 'fixed';
        if (fixed) fixedEls.add(el);
        if (fixed || el.closest('.hero-section')) gated.add(el);
        // Fixed things never cross the content observer's trimmed bottom edge, so they get
        // their own observer that just waits for them to be displayed
        (fixed ? ioFixed : io).observe(el);
    }

    // ---------- The intro ----------
    function openGate(offset) {
        if (gateOpen) return;
        gateOpen = true;
        gateAt = performance.now();
        gateOffset = reduced ? 0 : offset;
        if (!held.size) return;
        const batch = [...held].map((el) => ({ el, rect: el.getBoundingClientRect() }));
        held.clear();
        run(batch);
    }

    // The hero is hidden behind the black-hole overlay on a first visit, so it grows in as the
    // overlay dissolves (script.js adds .hidden to it) instead of playing unseen underneath
    function watchIntro() {
        const overlay = document.getElementById('enter-overlay');
        if (!overlay || !overlay.isConnected || overlay.classList.contains('hidden')) {
            openGate(HERO_SKIPPED);
            return;
        }
        introOverlay = overlay;
        const watcher = new MutationObserver(() => {
            if (overlay.classList.contains('hidden')) {
                watcher.disconnect();
                openGate(HERO_AFTER_INTRO);
            }
        });
        watcher.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    // ---------- Nodes added later ----------
    // firebase-live.js rebuilds project cards after its fetch. New nodes are observed like the
    // rest; a node standing in for one that was already revealed on screen just shows, so the
    // swap doesn't make a card vanish and grow in again.
    function onMutations(records) {
        let revealedGone = null;
        const added = [];
        for (const record of records) {
            record.removedNodes.forEach((node) => {
                if (node.nodeType !== 1 || node.isConnected) return; // moved, not removed
                if (observed.has(node)) {
                    io.unobserve(node);
                    ioFixed.unobserve(node);
                    observed.delete(node);
                    held.delete(node);
                }
                if (node.matches(SELECTOR) && node.classList.contains('visible')) {
                    (revealedGone || (revealedGone = new Set())).add(record.target);
                }
            });
            record.addedNodes.forEach((node) => { if (node.nodeType === 1) added.push(node); });
        }
        if (introOverlay && !gateOpen && !introOverlay.isConnected) openGate(HERO_AFTER_INTRO);

        for (const node of added) {
            if (!node.isConnected) continue;
            const els = node.matches(SELECTOR) ? [node] : [];
            if (node.firstElementChild) els.push(...node.querySelectorAll(SELECTOR));
            for (const el of els) {
                if (observed.has(el) || el.classList.contains('visible')) continue;
                if (revealedGone && revealedGone.has(el.parentNode) && el.getBoundingClientRect().top < window.innerHeight) {
                    observed.add(el);
                    el.classList.add('visible');
                    continue;
                }
                observe(el);
            }
        }
    }

    // ---------- Start-up ----------
    const showAll = () => document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('visible'));

    function flushPending() {
        flushQueued = false;
        if (!started) return;
        pending.forEach((el) => observe(el));
        pending.clear();
    }

    // If this ran late and the CSS failsafe has already faded something in, leave it be
    function adoptFailsafe() {
        if (!document.getAnimations) return;
        document.getAnimations().forEach((anim) => {
            const target = anim.effect && anim.effect.target;
            if (anim.animationName === 'sm-failsafe' && target && Number(anim.currentTime) > FAILSAFE_MS) {
                target.classList.add('visible');
            }
        });
    }

    function init() {
        if (started) return;
        started = true;
        if (!('IntersectionObserver' in window) || !canAnimate) {
            showAll();
            return;
        }
        try {
            io = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
            ioFixed = new IntersectionObserver(onIntersect, { threshold: 0 });
            adoptFailsafe();
            document.querySelectorAll(SELECTOR).forEach(observe);
            flushPending();
            new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true });
            document.documentElement.classList.add('sm-live'); // takes over from the CSS failsafe
            watchIntro();
        } catch (err) {
            showAll();
            console.warn('Scroll motion unavailable, showing everything:', err);
        }
    }

    // script.js (portfolioFX.observe) hands over nodes it creates. Deferred a microtask so the
    // mutation observer, which fires first, can spot swaps before these get observed.
    window.scrollMotion = {
        observe(el) {
            if (!el || el.nodeType !== 1) return;
            pending.add(el);
            if (!flushQueued) {
                flushQueued = true;
                Promise.resolve().then(flushPending);
            }
        },
    };

    // After script.js's own DOMContentLoaded handler, which removes the intro on repeat visits
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
