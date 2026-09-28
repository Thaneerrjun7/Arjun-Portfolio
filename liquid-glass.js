/* ============================================================
   LIQUID GLASS: interaction layer (styles in liquid-glass.css)

   Buttons, links and cards respond to the pointer like Apple's Liquid Glass
   controls: a highlight that follows the cursor, a slight magnify and lean
   toward it, a squish on press that springs back with a little jelly, and a
   glass lens in the nav that glides between items.

   All motion runs on real springs (damped harmonic oscillators stepped in one
   requestAnimationFrame loop that stops when everything is at rest), so any
   movement can be interrupted and redirected mid-flight without a jump.

   Composition contract: the scroll reveals and the project-card tilt own
   `transform`. Hover and press motion here only ever uses the individual
   `scale` and `translate` properties, written through a paused Web Animation
   so the pages' own `transition: all` rules never smear the spring.
   ============================================================ */

(() => {
    'use strict';

    if (typeof window.matchMedia !== 'function' || typeof Element.prototype.animate !== 'function') return;

    // --- Cached media flags ---
    // Read once and updated on 'change' instead of reading .matches per frame: in Chrome, reading
    // .matches inside rAF loops can swallow the change event (script.js does the same).
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    let reduced = reducedQuery.matches;
    let fine = fineQuery.matches;

    const onMediaChange = (query, fn) => {
        if (query.addEventListener) query.addEventListener('change', fn);
        else if (query.addListener) query.addListener(fn);
    };

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const pct = (v) => (v * 100).toFixed(2) + '%';
    const now = () => performance.now();

    // ======================== SPRINGS ========================
    // Parameterised the way Apple does it: response (seconds, roughly how fast it gets there) and
    // damping ratio (1 = no overshoot, lower = bouncier). Semi-implicit Euler in fixed 1/240 s
    // sub-steps keeps it stable and frame-rate independent.
    const STEP = 1 / 240;

    class Spring {
        constructor(value, eps) {
            this.x = value;
            this.v = 0;
            this.target = value;
            this.eps = eps;
            this.set(0.35, 1);
        }

        set(response, damping) {
            const w = (2 * Math.PI) / response;
            this.k = w * w;
            this.c = 2 * damping * w;
            return this;
        }

        // Returns true while still moving
        step(dt) {
            if (this.v === 0 && this.x === this.target) return false;
            let t = dt;
            while (t > 1e-6) {
                const h = t < STEP ? t : STEP;
                this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h;
                this.x += this.v * h;
                t -= h;
            }
            if (Math.abs(this.x - this.target) < this.eps && Math.abs(this.v) < this.eps * 20) {
                this.x = this.target;
                this.v = 0;
                return false;
            }
            return true;
        }

        snap(value = this.target) {
            this.x = this.target = value;
            this.v = 0;
        }
    }

    // [response, damping]
    const SPRING = {
        hoverIn: [0.34, 0.78],     // magnify toward the pointer, a hint of give
        hoverOut: [0.42, 0.9],     // settle back to rest
        lean: [0.3, 0.72],         // elastic lean toward the cursor
        press: [0.14, 1],          // squish: immediate, no wobble
        releaseX: [0.44, 0.5],     // release: gentle overshoot, the two axes slightly out of step
        releaseY: [0.5, 0.56],     // so it wobbles like jelly rather than pulsing
        chipIn: [0.28, 0.62],      // chips are small and light: livelier
        chipReleaseX: [0.36, 0.42],
        chipReleaseY: [0.42, 0.46],
    };

    const LENS = {
        lead: [0.26, 0.8],         // the nav lens edge heading into the move
        trail: [0.36, 0.84],       // the edge it drags behind it
        even: [0.32, 0.86],
        size: [0.36, 1],           // rest size the stretch is measured against
        appear: [0.38, 0.72],
        vanish: [0.3, 1],
    };

    // ======================== ONE FRAME LOOP ========================
    const animating = new Set();  // anything with tick(dt) -> stillMoving
    let rafId = 0;
    let lastTime = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerDirty = false;

    function schedule() {
        if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function frame(time) {
        rafId = 0;
        const dt = lastTime ? clamp((time - lastTime) / 1000, 0, 1 / 30) : 1 / 60;
        lastTime = time;

        // Pointer moves are batched: at most one highlight/lean update per frame
        if (pointerDirty) {
            pointerDirty = false;
            hovered.forEach((g) => g.track(pointerX, pointerY));
        }

        animating.forEach((a) => {
            if (!a.tick(dt)) animating.delete(a);
        });

        if (animating.size) schedule();
        else lastTime = 0;
    }

    function wake(a) {
        if (!animating.has(a)) {
            animating.add(a);
            a.onWake();
        }
        schedule();
    }

    // ======================== GLASS ELEMENTS ========================
    // Kinds, most specific first. hover/press are the ceilings; grow/squish (px) scale them down on
    // big elements so a wide card magnifies less than a small pill.
    const KINDS = [
        { name: 'button', sel: '.btn, .enter-btn', hover: 1.045, grow: 10, press: 0.95, squish: 9, lean: 3.5 },
        { name: 'icon', sel: '.hero-video-sound-btn, .hero-video-replay-btn, .nav-toggle', hover: 1.08, grow: 6, press: 0.9, squish: 6, lean: 2.5 },
        { name: 'wide', sel: '.contact-link', hover: 1.03, grow: 10, press: 0.97, squish: 10, lean: 3 },
        { name: 'chip', sel: '.skill-tag, .tag, .project-tech > span', hover: 1.08, grow: 7, press: 0.92, squish: 6, lean: 2, lively: true },
        { name: 'media', sel: '.project-card, .gallery-item', hover: 1.012, grow: 10, press: 0.975, squish: 12, lean: 3, layer: true },
        { name: 'card', sel: '.stat-card, .award-card, .skill-category, .edu-card, .timeline-card, .recommendation-card', hover: 1.02, grow: 12, press: 0.985, squish: 12, lean: 3, layer: true },
        // Text links last, so a.btn and a.contact-link keep their own kinds. Nav links belong to the lens.
        { name: 'capsule', sel: '.project-link, .nav-logo, a[href]:not(.nav-links a):not(.mobile-nav-links a)', hover: 1.05, grow: 5, press: 0.94, squish: 5, lean: 2 },
    ];
    const HOST_SEL = KINDS.map((k) => k.sel).join(', ');

    const states = new WeakMap();
    const hovered = new Set();
    const moved = new Set();  // glass currently carrying a scale/translate animation

    class Glass {
        constructor(el) {
            this.el = el;
            this.kind = KINDS.find((k) => el.matches(k.sel)) || KINDS[KINDS.length - 1];
            this.interactive = el.matches('a[href], button, [role="button"]');
            this.sx = new Spring(1, 4e-4);
            this.sy = new Spring(1, 4e-4);
            this.tx = new Spring(0, 0.03);
            this.ty = new Spring(0, 0.03);
            this.hovered = false;
            this.pressed = false;
            this.sheen = null;
            this.rect = null;
            this.rectDirty = true;
            this.motion = true;   // false for plain inline links, which can't take `scale`
            this.anim = null;
            this.hoverScale = this.kind.hover;
            this.pressScale = this.kind.press;
            this.leanX = this.kind.lean;
            this.leanY = this.kind.lean;
        }

        // Injected on first contact, and again if something re-renders the element's children.
        // Project cards get it inside their tilting inner panel, so the rim follows the tilt.
        ensureSheen() {
            const skin = this.el.querySelector(':scope > .project-card-inner') || this.el;
            if (this.sheen && this.sheen.parentNode === skin) return;
            const sheen = document.createElement('lg-sheen');
            sheen.setAttribute('aria-hidden', 'true');
            sheen.dataset.k = this.kind.name;
            const skinStyle = getComputedStyle(skin);
            const border = parseFloat(skinStyle.borderTopWidth) || 0;
            if (border && this.kind.name !== 'capsule') {
                // Cover the border too, so the rim lands on the element's real edge
                sheen.style.inset = `-${border}px`;
                sheen.style.setProperty('--lg-rim-w', `${Math.max(1, border)}px`);
            }
            this.motion = getComputedStyle(this.el).display !== 'inline';
            skin.appendChild(sheen);  // last child: never disturbs :nth-child styling
            this.sheen = sheen;
            this.rectDirty = true;
        }

        // The one layout read: on enter, on press, and after scroll/resize while hovered
        measure() {
            const r = this.sheen.getBoundingClientRect();
            this.rect = r;
            this.rectDirty = false;
            const s = Math.max(this.sx.x, 0.5);  // strip our own scale so targets don't drift
            const w = r.width / s;
            const h = r.height / s;
            const size = Math.max(w, h, 1);
            const k = this.kind;
            this.sheen.style.setProperty('--lg-r', `${Math.round(clamp(size * 0.6, 36, 360))}px`);
            this.hoverScale = Math.min(k.hover, 1 + k.grow / size);
            let press = Math.max(k.press, 1 - k.squish / size);
            if (k.name === 'wide' && !this.interactive) press = 1 - (1 - press) * 0.4;  // the location row isn't a link
            this.pressScale = press;
            this.leanX = Math.min(k.lean, w * 0.06);
            this.leanY = Math.min(k.lean, h * 0.06);
        }

        enter(x, y) {
            this.ensureSheen();
            this.hovered = true;
            hovered.add(this);
            this.measure();
            this.track(x, y);
            this.sheen.classList.add('is-hover');
            if (this.kind.lively) this.el.classList.add('lg-lift');
            if (reduced || !this.motion || this.pressed) return;
            const [r, d] = this.kind.lively ? SPRING.chipIn : SPRING.hoverIn;
            this.sx.set(r, d);
            this.sy.set(r, d);
            this.sx.target = this.sy.target = this.hoverScale;
            wake(this);
        }

        // Highlight follows the pointer 1:1; the lean chases it on a spring
        track(x, y) {
            if (!this.el.isConnected) {
                this.hovered = false;
                hovered.delete(this);
                return;
            }
            if (this.rectDirty) this.measure();
            const r = this.rect;
            if (!r.width || !r.height) return;
            const u = clamp((x - r.left) / r.width, 0, 1);
            const v = clamp((y - r.top) / r.height, 0, 1);
            const style = this.sheen.style;
            style.setProperty('--lg-x', pct(u));
            style.setProperty('--lg-y', pct(v));
            if (reduced || !this.motion) return;
            const give = this.pressed ? 0.4 : 1;
            this.tx.set(...SPRING.lean);
            this.ty.set(...SPRING.lean);
            this.tx.target = (u - 0.5) * 2 * this.leanX * give;
            this.ty.target = (v - 0.5) * 2 * this.leanY * give;
            wake(this);
        }

        leave() {
            this.hovered = false;
            hovered.delete(this);
            if (this.sheen) this.sheen.classList.remove('is-hover');
            const wasPressed = pressed === this;
            if (wasPressed) endPress();  // dragging off a pressed control lets it go
            if (reduced || !this.motion) {
                this.unlift();
                return;
            }
            if (!wasPressed) {
                this.sx.set(...SPRING.hoverOut);
                this.sy.set(...SPRING.hoverOut);
                this.sx.target = this.sy.target = 1;
            }
            this.tx.set(...SPRING.hoverOut);
            this.ty.set(...SPRING.hoverOut);
            this.tx.target = this.ty.target = 0;
            wake(this);
        }

        press(x, y) {
            this.ensureSheen();
            if (this.rectDirty || !this.hovered) this.measure();
            const r = this.rect;
            const u = r.width ? clamp((x - r.left) / r.width, 0, 1) : 0.5;
            const v = r.height ? clamp((y - r.top) / r.height, 0, 1) : 0.5;
            const style = this.sheen.style;
            style.setProperty('--lg-bx', pct(u));
            style.setProperty('--lg-by', pct(v));
            if (!this.hovered) {
                style.setProperty('--lg-x', pct(u));
                style.setProperty('--lg-y', pct(v));
            }
            this.sheen.classList.add('is-press');
            this.pressed = true;
            if (this.kind.lively) this.el.classList.add('lg-lift');
            if (reduced || !this.motion) return;
            const p = this.pressScale;
            this.sx.set(...SPRING.press);
            this.sy.set(...SPRING.press);
            this.sx.target = p;
            this.sy.target = p - (1 - p) * 0.3;  // a touch flatter than wide: glass giving under the finger
            this.tx.target *= 0.4;
            this.ty.target *= 0.4;
            wake(this);
        }

        release() {
            if (!this.pressed) return;
            this.pressed = false;
            if (this.sheen) this.sheen.classList.remove('is-press');
            if (reduced || !this.motion) {
                this.unlift();
                return;
            }
            const lively = this.kind.lively;
            this.sx.set(...(lively ? SPRING.chipReleaseX : SPRING.releaseX));
            this.sy.set(...(lively ? SPRING.chipReleaseY : SPRING.releaseY));
            this.sx.target = this.sy.target = this.hovered ? this.hoverScale : 1;
            if (this.hovered) {
                this.track(pointerX, pointerY);  // restore the full lean
            } else {
                this.tx.set(...SPRING.hoverOut);
                this.ty.set(...SPRING.hoverOut);
                this.tx.target = this.ty.target = 0;
            }
            wake(this);
        }

        focus(on) {
            this.ensureSheen();
            if (on) {
                this.sheen.style.setProperty('--lg-x', '50%');
                this.sheen.style.setProperty('--lg-y', '0%');
                if (this.rectDirty) this.measure();
            }
            this.sheen.classList.toggle('is-focus', on);
        }

        onWake() {
            if (this.kind.layer) this.el.classList.add('lg-layer');
        }

        tick(dt) {
            const moving = this.sx.step(dt) + this.sy.step(dt) + this.tx.step(dt) + this.ty.step(dt) > 0;
            this.apply();
            if (!moving) {
                this.el.classList.remove('lg-layer');  // at rest: let the browser re-raster crisp text
                this.unlift();
            }
            return moving;
        }

        apply() {
            const sx = this.sx.x;
            const sy = this.sy.x;
            const tx = this.tx.x;
            const ty = this.ty.x;
            if (Math.abs(sx - 1) < 1e-4 && Math.abs(sy - 1) < 1e-4 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01) {
                this.clear();
                return;
            }
            const kf = { scale: `${sx.toFixed(4)} ${sy.toFixed(4)}`, translate: `${tx.toFixed(2)}px ${ty.toFixed(2)}px` };
            if (this.anim && this.anim.playState !== 'idle') {
                this.anim.effect.setKeyframes([kf, kf]);
            } else {
                // Paused at t=0, so it simply holds whatever we set. Being an animation (not inline
                // style), it never triggers the element's CSS transitions.
                this.anim = this.el.animate([kf, kf], { duration: 1000, fill: 'both' });
                this.anim.pause();
                moved.add(this);
            }
        }

        clear() {
            if (this.anim) {
                this.anim.cancel();
                this.anim = null;
            }
            moved.delete(this);
        }

        unlift() {
            if (!this.hovered && !this.pressed) this.el.classList.remove('lg-lift');
        }

        // Reduced motion switched on mid-hover: drop straight to rest
        still() {
            this.sx.snap(1);
            this.sy.snap(1);
            this.tx.snap(0);
            this.ty.snap(0);
            this.clear();
            this.el.classList.remove('lg-layer');
        }
    }

    function glassFor(el) {
        let g = states.get(el);
        if (!g) {
            g = new Glass(el);
            states.set(el, g);
        }
        return g;
    }

    // ======================== NAV LENS ========================
    // One glass capsule per menu. Its four edges are separate springs: when it moves, the leading
    // edge runs on a stiffer spring than the trailing one, so the lens stretches along its path and
    // settles with a little jelly, like the iOS 26 tab bar selection. It is sized once per layout
    // and moved with transform only; border-radius is corrected so the ends stay round when stretched.
    const lenses = [];

    class Lens {
        constructor(list, opts) {
            this.list = list;
            this.opts = opts;
            this.links = Array.from(list.querySelectorAll('a'));
            this.el = document.createElement('li');
            this.el.className = 'lg-lens';
            this.el.setAttribute('aria-hidden', 'true');
            this.el.setAttribute('role', 'presentation');
            list.classList.add('lg-lens-host');
            list.appendChild(this.el);

            this.L = new Spring(0, 0.05);
            this.R = new Spring(0, 0.05);
            this.T = new Spring(0, 0.05);
            this.B = new Spring(0, 0.05);
            this.W = new Spring(0, 0.05);
            this.H = new Spring(0, 0.05);
            this.p = new Spring(1, 5e-4);  // press squish
            this.a = new Spring(1, 5e-4);  // appear / vanish
            this.springs = [this.L, this.R, this.T, this.B, this.W, this.H, this.p, this.a];

            this.boxes = new Map();
            this.w0 = 80;
            this.h0 = 34;
            this.target = null;
            this.visible = false;
            this.hiddenAt = -1e9;
            this.hover = null;
            this.focus = null;
            this.pressLink = null;
            this.tap = null;
            this.tapUntil = 0;
            this.leaveTimer = 0;

            list.addEventListener('pointerover', (e) => {
                if (!canHover(e)) return;
                const a = e.target.closest && e.target.closest('a');
                if (!a || !this.links.includes(a)) return;
                clearTimeout(this.leaveTimer);
                if (a !== this.hover) {
                    this.hover = a;
                    this.update();
                }
            }, { passive: true });

            // A short grace period so skimming past the edge of the bar doesn't send it home and back
            list.addEventListener('pointerleave', () => {
                if (!this.hover) return;
                clearTimeout(this.leaveTimer);
                this.leaveTimer = setTimeout(() => {
                    this.hover = null;
                    this.update();
                }, 70);
            }, { passive: true });

            if ('ResizeObserver' in window) {
                const ro = new ResizeObserver(() => this.relayout());
                ro.observe(list);
                list.querySelectorAll('li').forEach((li) => { if (li !== this.el) ro.observe(li); });
            }
            window.addEventListener('resize', () => this.relayout(), { passive: true });
        }

        // Link boxes in list coordinates, padded into capsules. Layout reads happen only here.
        measure() {
            const lr = this.list.getBoundingClientRect();
            const cs = getComputedStyle(this.list);
            const gap = parseFloat(cs.columnGap) || 0;
            const padX = this.opts.padX(gap);
            const padY = this.opts.padY;
            this.list.style.setProperty('--lg-pad-x', `${padX}px`);
            this.boxes.clear();
            let sumW = 0;
            let sumH = 0;
            for (const a of this.links) {
                const r = a.getBoundingClientRect();
                if (!r.width || !r.height) continue;  // menu not displayed at this width
                const box = {
                    l: r.left - lr.left - padX,
                    r: r.right - lr.left + padX,
                    t: r.top - lr.top - padY,
                    b: r.bottom - lr.top + padY,
                };
                this.boxes.set(a, box);
                sumW += box.r - box.l;
                sumH += box.b - box.t;
            }
            const n = this.boxes.size;
            if (n) {
                this.w0 = Math.round(sumW / n);
                this.h0 = Math.round(sumH / n);
                this.el.style.width = `${this.w0}px`;
                this.el.style.height = `${this.h0}px`;
                if (this.opts.onMeasure) this.opts.onMeasure(this.w0, this.h0);
            }
        }

        relayout() {
            this.measure();
            const box = this.target && this.boxes.get(this.target);
            if (box) {
                this.snapTo(box);
                this.render();
            }
            this.update();
        }

        resolve() {
            const t = this.pressLink || this.hover || this.focus
                || (this.tap && now() < this.tapUntil ? this.tap : null)
                || this.opts.active();
            return t && this.boxes.has(t) ? t : null;
        }

        update() {
            const t = this.resolve();
            if (!t) {
                this.hide();
                return;
            }
            if (t === this.target && this.visible) return;
            const box = this.boxes.get(t);
            // Still fading out from a moment ago? Glide from there rather than popping in anew
            const glide = this.visible || now() - this.hiddenAt < 200;
            this.target = t;
            this.el.classList.toggle('is-accent', t.classList.contains('nav-resume-glow'));
            if (reduced || !glide) this.snapTo(box);
            else this.glideTo(box);
            if (!this.visible) {
                this.visible = true;
                this.el.classList.add('is-visible');
                if (reduced) this.a.snap(1);
                else {
                    if (!glide) this.a.snap(0.82);  // materialise: grow in as it fades in
                    this.a.set(...LENS.appear).target = 1;
                }
            }
            if (reduced) this.render();
            else wake(this);
        }

        hide() {
            if (!this.visible) return;
            this.visible = false;
            this.target = null;
            this.hiddenAt = now();
            this.el.classList.remove('is-visible');
            if (!reduced) {
                this.a.set(...LENS.vanish).target = 0.86;
                wake(this);
            }
        }

        snapTo(b) {
            this.L.snap(b.l);
            this.R.snap(b.r);
            this.T.snap(b.t);
            this.B.snap(b.b);
            this.W.snap(b.r - b.l);
            this.H.snap(b.b - b.t);
        }

        glideTo(b) {
            this.lead(this.L, this.R, (b.l + b.r) / 2 - (this.L.x + this.R.x) / 2);
            this.lead(this.T, this.B, (b.t + b.b) / 2 - (this.T.x + this.B.x) / 2);
            this.L.target = b.l;
            this.R.target = b.r;
            this.T.target = b.t;
            this.B.target = b.b;
            this.W.set(...LENS.size).target = b.r - b.l;
            this.H.set(...LENS.size).target = b.b - b.t;
        }

        // Velocity carries over when a spring is re-targeted mid-flight, so a quick change of
        // mind bends the path instead of hitting a wall
        lead(lo, hi, d) {
            if (Math.abs(d) < 1) {
                lo.set(...LENS.even);
                hi.set(...LENS.even);
            } else if (d > 0) {
                hi.set(...LENS.lead);
                lo.set(...LENS.trail);
            } else {
                lo.set(...LENS.lead);
                hi.set(...LENS.trail);
            }
        }

        press(a) {
            if (!this.boxes.has(a)) return;
            this.pressLink = a;
            this.el.classList.add('is-pressed');
            this.update();
            if (reduced) return;  // reduced motion: the brighter glass is the whole response
            this.p.set(...SPRING.press).target = 0.9;
            wake(this);
        }

        release(pointerType) {
            if (!this.pressLink) return;
            const a = this.pressLink;
            this.pressLink = null;
            this.el.classList.remove('is-pressed');
            // A tap on touch has no hover to fall back to: hold the lens on the tapped item while the
            // menu closes and the page scrolls there, instead of darting back to the old section
            if (pointerType === 'touch') {
                this.tap = a;
                this.tapUntil = now() + 900;
                setTimeout(() => this.update(), 950);
            }
            if (!reduced) {
                this.p.set(...SPRING.releaseX).target = 1;
                wake(this);
            }
            this.update();
        }

        setFocus(a) {
            this.focus = a;
            this.update();
        }

        onWake() {
            this.el.classList.add('lg-anim');
        }

        tick(dt) {
            let moving = 0;
            for (const s of this.springs) moving += s.step(dt);
            this.render();
            if (!moving) this.el.classList.remove('lg-anim');
            return moving > 0;
        }

        // Past ~1.8x its resting length the stretch rubber-bands, held back from the leading edge,
        // so a long jump reads as a quick droplet rather than a comet
        static limit(lo, hi, rest, vLo, vHi) {
            const max = rest * 1.8;
            const span = hi - lo;
            if (span <= max) return [lo, hi];
            const band = max + (span - max) * 0.3;
            return Math.abs(vHi) >= Math.abs(vLo) ? [hi - band, hi] : [lo, lo + band];
        }

        render() {
            const [l, r] = Lens.limit(this.L.x, this.R.x, this.W.x, this.L.v, this.R.v);
            const [t, b] = Lens.limit(this.T.x, this.B.x, this.H.x, this.T.v, this.B.v);
            let w = Math.max(r - l, 4);
            let h = Math.max(b - t, 4);
            // Jelly: stretched along one axis, it thins a little across the other
            const stretchX = w / Math.max(this.W.x, 1);
            const stretchY = h / Math.max(this.H.x, 1);
            const s = this.p.x * this.a.x;
            w *= clamp(1 - (stretchY - 1) * 0.25, 0.8, 1.06) * s;
            h *= clamp(1 - (stretchX - 1) * 0.25, 0.8, 1.06) * s;
            const x = (l + r) / 2 - w / 2;
            const y = (t + b) / 2 - h / 2;
            const kx = w / this.w0;
            const ky = h / this.h0;
            const radius = h / 2;
            const style = this.el.style;
            style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${kx.toFixed(4)}, ${ky.toFixed(4)})`;
            style.borderRadius = `${(radius / kx).toFixed(2)}px / ${(radius / ky).toFixed(2)}px`;
        }

        still() {
            this.springs.forEach((s) => s.snap());
            this.p.snap(1);
            if (this.visible) this.a.snap(1);
            this.render();
            this.el.classList.remove('lg-anim');
        }
    }

    function lensFor(a) {
        for (const lens of lenses) if (lens.links.includes(a)) return lens;
        return null;
    }

    // ======================== REFRACTION (Chromium only) ========================
    // backdrop-filter: url(#svg-filter) with feDisplacementMap bends what's behind the glass at its
    // edges. Only Chromium renders SVG filters in backdrop-filter, so everything else keeps the plain
    // blur from the stylesheet. The map is drawn for each element's exact size so the rounded
    // ends refract evenly.
    const refraction = (() => {
        const brands = navigator.userAgentData && navigator.userAgentData.brands;
        const chromium = Array.isArray(brands) && brands.some((b) => /Chromium/i.test(b.brand));
        if (!chromium || !window.CSS || !CSS.supports('backdrop-filter', 'url(#lg) blur(1px)')) return null;

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.appendChild(svg);
        const filters = {};

        // Red encodes x displacement and green y, 50% grey is neutral: flat in the middle, bending
        // toward the centre across a blurred bezel near the rim
        function mapURL(w, h, bezel) {
            const r = h / 2;
            const svgText = `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
                + '<defs>'
                + '<linearGradient id="x" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>'
                + '<linearGradient id="y" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient>'
                + `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(bezel / 2.5).toFixed(2)}"/></filter>`
                + '</defs>'
                + `<rect width="${w}" height="${h}" fill="#808080"/>`
                + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>`
                + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/>`
                + `<rect x="${bezel}" y="${bezel}" width="${w - 2 * bezel}" height="${h - 2 * bezel}" rx="${Math.max(r - bezel, 0)}" fill="#808080" filter="url(#b)"/>`
                + '</svg>';
            return `data:image/svg+xml,${encodeURIComponent(svgText)}`;
        }

        function define(id, scale) {
            const filter = document.createElementNS(NS, 'filter');
            filter.setAttribute('id', id);
            filter.setAttribute('x', '0');
            filter.setAttribute('y', '0');
            filter.setAttribute('width', '100%');
            filter.setAttribute('height', '100%');
            filter.setAttribute('color-interpolation-filters', 'sRGB');  // read the map's values as drawn
            const image = document.createElementNS(NS, 'feImage');
            image.setAttribute('preserveAspectRatio', 'none');
            image.setAttribute('result', 'map');
            const displace = document.createElementNS(NS, 'feDisplacementMap');
            displace.setAttribute('in', 'SourceGraphic');
            displace.setAttribute('in2', 'map');
            displace.setAttribute('scale', String(scale));
            displace.setAttribute('xChannelSelector', 'R');
            displace.setAttribute('yChannelSelector', 'G');
            filter.append(image, displace);
            svg.appendChild(filter);
            filters[id] = { image, key: '' };
        }

        function size(id, w, h, bezelRatio) {
            const f = filters[id];
            w = Math.round(w);
            h = Math.round(h);
            if (!f || w < 8 || h < 8) return;
            const key = `${w}x${h}`;
            if (f.key === key) return;
            f.key = key;
            const bezel = Math.max(2, Math.round(Math.min(h * bezelRatio, w / 4)));
            f.image.setAttribute('href', mapURL(w, h, bezel));
        }

        document.documentElement.classList.add('lg-refract');
        return { define, size };
    })();

    // ======================== WIRING ========================
    const canHover = (e) => fine && (e.pointerType === 'mouse' || e.pointerType === 'pen');

    let pressed = null;       // glass currently held down by a pointer
    let pressOrigin = null;   // where a mouse press started (re-press if dragged back over it)
    let pendingTouch = null;  // touch press waiting out the scroll-detection delay
    let pressedLens = null;
    let keyGlass = null;
    let keyLens = null;

    // Touch presses wait a beat, like iOS scroll views do, so starting a scroll on a card doesn't
    // flash every control under the finger. A quick tap still gets the full squish.
    const TOUCH_DELAY = 70;
    const TAP_HOLD = 90;

    function startPress(g, x, y) {
        if (pressed && pressed !== g) pressed.release();
        pressed = g;
        g.press(x, y);
    }

    function endPress() {
        if (!pressed) return;
        const g = pressed;
        pressed = null;
        g.release();
    }

    function cancelPendingTouch() {
        if (!pendingTouch) return;
        clearTimeout(pendingTouch.timer);
        pendingTouch = null;
    }

    // Enter/leave for every element, in the capture phase at the document. Covers elements added
    // later too (project cards are rebuilt from Firestore) without per-element listeners.
    document.addEventListener('pointerenter', (e) => {
        const t = e.target;
        if (!canHover(e) || !t || t.nodeType !== 1 || !t.matches(HOST_SEL)) return;
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (scrolling) return;  // content sliding under a still cursor isn't the user pointing at it
        const g = glassFor(t);
        g.enter(e.clientX, e.clientY);
        if (pressOrigin === g && (e.buttons & 1)) startPress(g, e.clientX, e.clientY);
    }, { capture: true, passive: true });

    document.addEventListener('pointerleave', (e) => {
        const t = e.target;
        if (!t || t.nodeType !== 1) return;
        const g = states.get(t);
        if (g && g.hovered) g.leave();
    }, { capture: true, passive: true });

    window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') {
            // Finger moving: it's a scroll or a drag, not a tap
            if (pendingTouch && e.pointerId === pendingTouch.id
                && Math.hypot(e.clientX - pendingTouch.x, e.clientY - pendingTouch.y) > 10) {
                const started = pendingTouch.started;
                cancelPendingTouch();
                if (started) endPress();
            }
            return;
        }
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (hovered.size && !scrolling) {
            pointerDirty = true;
            schedule();
        }
    }, { passive: true });

    // While the page scrolls, hover lets go (as iPadOS pointer effects do) instead of every card
    // that slides under a still cursor magnifying, measuring and springing in turn. That churn
    // cost about a quarter of scroll frame rate in testing. When scrolling settles, whatever ended
    // up under the cursor lights up.
    const SCROLL_IDLE = 140;
    let scrolling = false;
    let scrollTimer = 0;

    function scrollSettled() {
        scrolling = false;
        if (!fine) return;
        document.querySelectorAll(':hover').forEach((el) => {
            if (!el.matches(HOST_SEL)) return;
            const g = glassFor(el);
            if (!g.hovered) g.enter(pointerX, pointerY);
        });
    }

    window.addEventListener('scroll', () => {
        if (!scrolling) {
            scrolling = true;
            hovered.forEach((g) => g.leave());
        }
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(scrollSettled, SCROLL_IDLE);
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (!hovered.size) return;
        hovered.forEach((g) => { g.rectDirty = true; });
        pointerDirty = true;
        schedule();
    }, { passive: true });

    document.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
        if (!t || !t.closest) return;

        const navLink = t.closest('.nav-links a, .mobile-nav-links a');
        const lens = navLink && lensFor(navLink);
        if (lens) {
            lens.press(navLink);
            pressedLens = { lens, type: e.pointerType };
        }

        const host = t.closest(HOST_SEL);  // innermost: a tag inside a card presses the tag
        if (!host) return;
        const g = glassFor(host);
        if (e.pointerType === 'touch') {
            cancelPendingTouch();
            const pending = { g, id: e.pointerId, x: e.clientX, y: e.clientY, started: false, timer: 0 };
            pending.timer = setTimeout(() => {
                pending.started = true;
                startPress(g, pending.x, pending.y);
            }, TOUCH_DELAY);
            pendingTouch = pending;
        } else {
            pressOrigin = g;
            startPress(g, e.clientX, e.clientY);
        }
    }, { capture: true, passive: true });

    function endPointer(e, cancelled) {
        if (!e.isPrimary) return;
        if (pressedLens) {
            pressedLens.lens.release(cancelled ? 'cancel' : pressedLens.type);
            pressedLens = null;
        }
        pressOrigin = null;
        if (pendingTouch && e.pointerId === pendingTouch.id) {
            const { g, x, y, started } = pendingTouch;
            cancelPendingTouch();
            if (!started && !cancelled) {
                // Lifted before the delay ran out: play the press now, then let it go
                startPress(g, x, y);
                setTimeout(() => { if (pressed === g) endPress(); }, TAP_HOLD);
                return;
            }
        }
        endPress();
    }
    document.addEventListener('pointerup', (e) => endPointer(e, false), { capture: true, passive: true });
    document.addEventListener('pointercancel', (e) => endPointer(e, true), { capture: true, passive: true });

    // Keyboard: Enter on links and buttons, Space on buttons, gets the same press
    const isPressKey = (e) => e.key === 'Enter' || e.key === ' ';
    document.addEventListener('keydown', (e) => {
        if (e.repeat || !isPressKey(e)) return;
        const el = document.activeElement;
        if (!el || el === document.body || !el.matches) return;
        const isButton = el.matches('button, [role="button"]');
        if (!isButton && (e.key === ' ' || !el.matches('a[href]'))) return;
        const lens = lensFor(el);
        if (lens) {
            lens.press(el);
            keyLens = lens;
        }
        if (el.matches(HOST_SEL)) {
            const r = el.getBoundingClientRect();
            keyGlass = glassFor(el);
            keyGlass.press(r.left + r.width / 2, r.top + r.height / 2);
        }
    });

    function endKeyPress() {
        if (keyGlass) {
            keyGlass.release();
            keyGlass = null;
        }
        if (keyLens) {
            keyLens.release('keyboard');
            keyLens = null;
        }
    }
    document.addEventListener('keyup', (e) => { if (isPressKey(e)) endKeyPress(); });
    window.addEventListener('blur', () => {
        endKeyPress();
        endPress();
    });

    // Keyboard focus lights the glass from above, and the nav lens follows it
    const focusVisible = (el) => {
        try { return el.matches(':focus-visible'); } catch (err) { return true; }
    };
    document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (!t || t.nodeType !== 1 || !focusVisible(t)) return;
        const lens = lensFor(t);
        if (lens) lens.setFocus(t);
        if (t.matches(HOST_SEL)) glassFor(t).focus(true);
    });
    document.addEventListener('focusout', (e) => {
        const t = e.target;
        if (!t || t.nodeType !== 1) return;
        if (keyGlass && keyGlass.el === t) endKeyPress();
        const lens = lensFor(t);
        if (lens && lens.focus === t) lens.setFocus(null);
        const g = states.get(t);
        if (g && g.sheen) g.focus(false);
    });

    // --- Media changes, live ---
    onMediaChange(reducedQuery, (e) => {
        reduced = e.matches;
        if (reduced) {
            moved.forEach((g) => g.still());
            lenses.forEach((lens) => lens.still());
        } else {
            hovered.forEach((g) => g.enter(pointerX, pointerY));
        }
    });
    onMediaChange(fineQuery, (e) => {
        fine = e.matches;
        if (!fine) hovered.forEach((g) => g.leave());
    });

    // --- Nav lenses ---
    const desktopList = document.querySelector('.nav-links');
    const mobileList = document.querySelector('.mobile-nav-links');
    const activeDesktop = () => (desktopList ? desktopList.querySelector('a.active') : null);

    if (refraction) refraction.define('lg-refract-lens', 12);

    if (desktopList) {
        lenses.push(new Lens(desktopList, {
            padX: (gap) => clamp(gap / 2 - 3, 6, 14),
            padY: 7,
            active: activeDesktop,
            onMeasure: refraction ? (w, h) => refraction.size('lg-refract-lens', w, h, 0.3) : null,
        }));
    }
    if (mobileList) {
        lenses.push(new Lens(mobileList, {
            padX: () => 22,
            padY: 2,
            // script.js only marks the desktop links active; mirror that onto the matching mobile link
            active: () => {
                const a = activeDesktop();
                const href = a && a.getAttribute('href');
                return href ? Array.from(mobileList.querySelectorAll('a')).find((m) => m.getAttribute('href') === href) || null : null;
            },
        }));
    }

    // script.js toggles .active on the desktop links while scrolling; follow it
    if (desktopList && lenses.length) {
        new MutationObserver((records) => {
            if (records.some((r) => r.target.tagName === 'A')) lenses.forEach((lens) => lens.update());
        }).observe(desktopList, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    const relayoutAll = () => lenses.forEach((lens) => lens.relayout());
    relayoutAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayoutAll);

    // --- Refraction on the intro's Enter button, over the black hole ---
    const enterBtn = document.getElementById('enter-btn');
    if (refraction && enterBtn) {
        refraction.define('lg-refract-enter', 22);
        const sizeEnter = () => {
            if (enterBtn.isConnected) refraction.size('lg-refract-enter', enterBtn.offsetWidth, enterBtn.offsetHeight, 0.3);
        };
        sizeEnter();
        if ('ResizeObserver' in window) new ResizeObserver(sizeEnter).observe(enterBtn);
    }
})();
