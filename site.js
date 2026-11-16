/*
   Arjun Shanker - portfolio script.
   The sky, the Tamil-to-English decode text, scroll reveals, the header and its glass lens,
   the scroll progress bar, and retro mode (its glitch intro and boot screen).
*/
(() => {
    'use strict';

    // The flag is cached: reading .matches on every frame can swallow the query's change event in Chrome
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;
    motionQuery.addEventListener('change', (e) => { reduced = e.matches; });
    const lessMotion = () => reduced;

    /* ---------------- Tamil decode text ----------------
       Two beats, like an old terminal: random Tamil letters type out behind a block cursor,
       then settle into English from left to right. No real Tamil words are stored anywhere:
       the letters are picked at random, so there is nothing to read (or to get wrong). */
    const TIMING = {
        typePerChar: 60, typeMin: 480, typeMax: 1200,      // beat 1: the Tamil types out
        hold: 560,                                         // the cursor blinks over the finished line
        blink: 140,                                        // half a blink, in ms
        settlePerChar: 50, settleMin: 550, settleMax: 1200, // beat 2: it settles into English
        tick: 33,                                          // frame time
        flicker: 2,                                        // unsettled letters change every n ticks
    };
    const TAMIL_RATIO = 0.72;                              // Tamil letters shown per English letter
    const GLYPHS = [...'அஆஇஈஉஊஎஏஐஒஓகஙசஞடணதநபமயரலவழளறன'];
    const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const timers = new WeakMap();

    // What is on screen mid-animation: settled English, then Tamil letters, then the cursor
    function paint(out, english, tamil, cursor = true) {
        const frag = document.createDocumentFragment();
        if (english) frag.append(english);
        if (tamil) {
            const g = document.createElement('span');
            g.className = 'g';
            g.textContent = tamil;
            frag.append(g);
        }
        if (cursor !== null) {
            const c = document.createElement('span');
            c.className = cursor ? 'cur' : 'cur off';
            frag.append(c);
        }
        out.replaceChildren(frag);
    }

    // Before its turn the text is there but unseen, so it already takes up the room it will need
    function wait(out, text) {
        const ghost = document.createElement('span');
        ghost.className = 'ghost';
        ghost.textContent = text;
        out.replaceChildren(ghost);
    }

    function setup(el) {
        if (el.dataset.ready) return;
        el.dataset.ready = '1';
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        el.dataset.text = text;
        el.classList.add('decode');
        const hidden = document.createElement('span');
        hidden.className = 'sr-only';
        hidden.textContent = text;
        const out = document.createElement('span');
        out.setAttribute('aria-hidden', 'true');
        el.replaceChildren(hidden, out);
        if (lessMotion()) out.textContent = text;
        else wait(out, text);
    }

    function decode(el, to) {
        setup(el);
        const out = el.lastElementChild;
        const text = to ?? el.dataset.text;
        el.dataset.text = text;
        el.firstElementChild.textContent = text;
        clearInterval(timers.get(el));
        if (lessMotion()) { out.textContent = text; return; }
        const chars = [...text];
        const n = chars.length;
        const box = getComputedStyle(el).display === 'inline' ? el.parentElement : el;
        if (!box.dataset.held) {
            wait(out, text);
            const h = box.getBoundingClientRect().height;
            if (h) { box.style.height = `${h}px`; box.dataset.held = '1'; }
        }
        const release = () => { box.style.height = ''; delete box.dataset.held; };
        const finish = () => {
            release();
            // the cursor blinks a few more times at the end of the line, then leaves
            const cur = document.createElement('span');
            cur.className = 'cur blink';
            out.replaceChildren(text, cur);
            setTimeout(() => cur.remove(), 1300);
        };
        // retro mode, and anything marked data-plain (the menus), types its English straight out: no Tamil
        if (document.documentElement.classList.contains('retro') || el.dataset.plain) {
            // section titles type slowly, like the old machine is thinking about each letter
            const slow = !el.dataset.plain && el.closest(TITLES);
            const total = slow ? clamp(n * 95, 700, 2600) : clamp(n * 55, 350, 1600);
            const begun = performance.now();
            el.dataset.typingUntil = String(begun + total);
            paint(out, '', '');
            const rid = setInterval(() => {
                const k = Math.floor(((performance.now() - begun) / total) * (n + 1));
                if (k >= n) { clearInterval(rid); finish(); return; }
                paint(out, chars.slice(0, k).join(''), '');
            }, TIMING.tick);
            timers.set(el, rid);
            return;
        }
        const typeMs = clamp(n * TIMING.typePerChar, TIMING.typeMin, TIMING.typeMax);
        const settleMs = clamp(n * TIMING.settlePerChar, TIMING.settleMin, TIMING.settleMax);
        // Tamil letters are wider than Latin ones, so fewer of them stand in for the English. Both are
        // measured here, in this element's own type, and every word is cut down until its Tamil is
        // narrower than its English: the Tamil then never needs more lines than the text it becomes
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
        const sample = document.createElement('span');
        sample.className = 'g';
        sample.textContent = GLYPHS.join('');
        probe.append(text, sample);
        out.append(probe);
        const tamilWidth = sample.getBoundingClientRect().width / GLYPHS.length;
        const latinWidth = (probe.getBoundingClientRect().width - tamilWidth * GLYPHS.length) / n;
        probe.remove();
        const ratio = tamilWidth > 0 ? Math.min(TAMIL_RATIO, (latinWidth / tamilWidth) * 0.82) : TAMIL_RATIO;
        const short = (list) => {
            const kept = [];
            let word = 0;
            const cut = () => { if (word) kept.push(...Array.from({ length: Math.max(1, Math.floor(word * ratio)) }, pick)); word = 0; };
            for (const c of list) { if (c === ' ') { cut(); kept.push(' '); } else word++; }
            cut();
            return kept;
        };
        const full = short(chars);
        let tail = full;
        let tick = 0;
        const started = performance.now();
        paint(out, '', '');
        const id = setInterval(() => {
            const t = performance.now() - started;
            if (t < typeMs) {                                   // typing
                paint(out, '', full.slice(0, Math.ceil((t / typeMs) * full.length)).join(''));
            } else if (t < typeMs + TIMING.hold) {              // holding, cursor blinking
                paint(out, '', full.join(''), Math.floor((t - typeMs) / TIMING.blink) % 2 === 1);
            } else {                                            // settling
                const settled = Math.floor(((t - typeMs - TIMING.hold) / settleMs) * (n + 1));
                if (settled >= n) {
                    clearInterval(id);
                    finish();
                    return;
                }
                if (tick++ % TIMING.flicker === 0) tail = short(chars.slice(settled));
                paint(out, chars.slice(0, settled).join(''), tail.join(''));
            }
        }, TIMING.tick);
        timers.set(el, id);
    }

    // Headings everywhere decode once, the first time they come into view.
    // Section titles stay watched: in retro mode they type themselves out again every time they scroll back in.
    const TITLES = 'h2.title, .contact h2, .page h1, .page h2';
    const AUTO = '.hero-name, h2.title, .contact h2, .page h1, .page h2, .page h3, .project-title, .xp-role, .skill-row h3, .edu-item h3, .certs h3, .status-title';
    const decodeSeen = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const el = entry.target;
            const title = el.closest(TITLES);
            if (!entry.isIntersecting) { if (title) el.dataset.away = '1'; continue; }
            if (!title) { decodeSeen.unobserve(el); decode(el); continue; }
            const first = !el.dataset.seen;
            const back = el.dataset.away && document.documentElement.classList.contains('retro');
            delete el.dataset.away;
            // still typing from last time: let it finish rather than start over
            if (!first && performance.now() < Number(el.dataset.typingUntil || 0)) continue;
            if (first || back) { el.dataset.seen = '1'; decode(el); }
        }
    }, { threshold: 0.2 });
    const decodeWhenSeen = (el) => { setup(el); decodeSeen.observe(el); };
    document.querySelectorAll(AUTO).forEach((el) => {
        const target = el.querySelector(':scope > .decode') ?? el;
        if (target.children.length === 0) decodeWhenSeen(target);
    });

    // Header links type out once the fonts are in (plain English, no Tamil), with their width held so the bar does not shuffle
    const navWords = [...document.querySelectorAll('.nav-links .decode')];
    navWords.forEach((el) => { el.dataset.plain = '1'; setup(el); });
    const startNav = () => navWords.forEach((el, i) => {
        if (lessMotion()) return;
        if (!el.getBoundingClientRect().width) { el.lastElementChild.textContent = el.dataset.text; return; }
        el.style.width = `${el.getBoundingClientRect().width}px`;
        setTimeout(() => decode(el), 150 + i * 90);
        setTimeout(() => { el.style.width = ''; }, 150 + i * 90 + 3200);
    });
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(startNav);

    // The hero's rotating second line
    const rotator = document.querySelector('[data-rotate]');
    if (rotator) {
        const words = JSON.parse(rotator.dataset.rotate);
        let index = 0;
        setup(rotator);
        setTimeout(() => decode(rotator, words[0]), 500);
        setInterval(() => {
            if (document.hidden || lessMotion()) return;
            index = (index + 1) % words.length;
            decode(rotator, words[index]);
        }, 6000);
    }

    /* ---------------- Scroll reveals ---------------- */
    const revealSeen = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('in');
            revealSeen.unobserve(entry.target);
        }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    const observe = (el) => {
        el.classList.add('reveal');
        revealSeen.observe(el);
    };
    document.querySelectorAll('.reveal').forEach((el) => revealSeen.observe(el));
    // firebase-live.js adds and refills cards after load and hands them over here
    window.siteFX = { observe, decodeWhenSeen };

    /* ---------------- Section links land where they should ----------------
       The page can still be settling (pictures arriving, headings typing) while a smooth scroll is
       under way, which would leave the section short of its mark. So check again when it stops. */
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href^="#"]');
        const target = a && a.getAttribute('href').length > 1 && document.getElementById(a.getAttribute('href').slice(1));
        if (!target) return;
        const want = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        let tries = 0;
        const check = () => {
            const off = target.getBoundingClientRect().top - want;
            const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            if (Math.abs(off) < 6 || atEnd || ++tries > 3) return;
            target.scrollIntoView();
            arm();
        };
        const arm = () => {
            let done = false;
            const once = () => { if (done) return; done = true; window.removeEventListener('scrollend', once); setTimeout(check, 60); };
            window.addEventListener('scrollend', once);
            setTimeout(once, 1600);
        };
        arm();
    });

    /* ---------------- Header: glass state, current section, menu ---------------- */
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const sections = [...document.querySelectorAll('main section[id]')];
    const sectionLinks = [...document.querySelectorAll('.nav-links a[data-section]')];
    const lenses = [];

    function updateHeader() {
        if (!navbar) return;
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        const y = window.scrollY + 200;
        let current = null;
        for (const section of sections) {
            if (y >= section.offsetTop && y < section.offsetTop + section.offsetHeight) current = section.id;
        }
        let changed = false;
        for (const link of sectionLinks) {
            const on = link.dataset.section === current;
            if (link.classList.contains('active') !== on) { link.classList.toggle('active', on); changed = true; }
        }
        if (changed) lenses.forEach((lens) => lens.update());
    }
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { updateHeader(); ticking = false; });
    }, { passive: true });

    // a chosen item lets its glass bubble pop before the menu goes, so the press is seen to land
    const MENU_CLOSE_MS = 240;
    let menuClosing = 0;
    function setMenu(open) {
        if (!navToggle || !mobileMenu) return;
        clearTimeout(menuClosing);
        navToggle.classList.toggle('active', open);
        mobileMenu.classList.toggle('active', open);
        navToggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
        // the lens only shows while a link is being pressed here: it has nothing to rest on mid-typing.
        // Closing ends any press still under way (Escape or a resize mid-slide), so nothing opens late
        lenses.forEach((lens) => { if (!open && lens.slide) lens.cancel(); else lens.update(); });
        // every item types out again (plain English, no Tamil) each time the menu opens
        if (open) mobileMenu.querySelectorAll('.decode').forEach((el, i) => {
            setup(el);
            if (lessMotion()) return;
            wait(el.lastElementChild, el.dataset.text);
            el.style.width = '';
            el.style.width = `${Math.ceil(el.getBoundingClientRect().width) + 2}px`;
            setTimeout(() => decode(el), 80 + i * 90);
        });
    }
    if (navToggle && mobileMenu) {
        mobileMenu.querySelectorAll('.decode').forEach((el) => { el.dataset.plain = '1'; setup(el); });
        navToggle.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('active')));
        mobileMenu.addEventListener('click', (e) => {
            if (!e.target.closest('a')) return;
            clearTimeout(menuClosing);
            if (lessMotion()) setMenu(false);
            else menuClosing = setTimeout(() => setMenu(false), MENU_CLOSE_MS);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
        window.matchMedia('(min-width: 769px)').addEventListener('change', () => setMenu(false));
    }

    /* ---------------- The glass lens that glides between header links ----------------
       Its edges are separate springs: the edge heading into a move is stiffer than the one
       trailing behind, so the lens stretches along its path and settles with a little give. */
    class Spring {
        constructor(x) { this.x = x; this.v = 0; this.to = x; this.set(0.35, 1); }
        set(response, damping) { const w = (2 * Math.PI) / response; this.k = w * w; this.c = 2 * damping * w; return this; }
        snap(x = this.to) { this.x = this.to = x; this.v = 0; }
        step(dt) {
            if (this.v === 0 && this.x === this.to) return false;
            for (let t = dt; t > 1e-6; t -= 1 / 240) {
                const h = Math.min(t, 1 / 240);
                this.v += (-this.k * (this.x - this.to) - this.c * this.v) * h;
                this.x += this.v * h;
            }
            if (Math.abs(this.x - this.to) < 0.05 && Math.abs(this.v) < 1) { this.snap(); return false; }
            return true;
        }
    }
    const LEAD = [0.26, 0.8], TRAIL = [0.36, 0.84];

    class Lens {
        constructor(list, { padX, padY, active, slide = false }) {
            Object.assign(this, { list, padX, padY, active, slide, hover: null, focus: null, press: null, target: null, visible: false, frame: 0, last: 0 });
            this.links = [...list.querySelectorAll('a')];
            this.el = document.createElement('li');
            this.el.className = 'lg-lens';
            this.el.setAttribute('aria-hidden', 'true');
            this.el.setAttribute('role', 'presentation');
            list.classList.add('lg-lens-host');
            list.append(this.el);
            this.L = new Spring(0); this.R = new Spring(0); this.T = new Spring(0); this.B = new Spring(0);
            this.a = new Spring(1).set(0.38, 0.72);
            const link = (e) => { const a = e.target.closest && e.target.closest('a'); return a && this.links.includes(a) ? a : null; };
            list.addEventListener('pointerover', (e) => {
                if (e.pointerType === 'touch') return;
                const a = link(e);
                if (!a) return;
                clearTimeout(this.leaving);
                if (a !== this.hover) { this.hover = a; this.update(); }
            }, { passive: true });
            list.addEventListener('pointerleave', () => {
                clearTimeout(this.leaving);
                this.leaving = setTimeout(() => { this.hover = null; this.update(); }, 70);
            }, { passive: true });
            if (slide) this.slideTo(link);
            else {
                list.addEventListener('pointerdown', (e) => { const a = link(e); if (!a) return; this.press = a; this.el.classList.add('is-pressed'); this.update(); }, { passive: true });
                const release = () => { if (!this.press) return; this.el.classList.remove('is-pressed'); setTimeout(() => { this.press = null; this.update(); }, 260); };
                window.addEventListener('pointerup', release, { passive: true });
                window.addEventListener('pointercancel', release, { passive: true });
            }
            list.addEventListener('focusin', (e) => { const a = link(e); if (a && a.matches(':focus-visible')) { this.focus = a; this.update(); } });
            list.addEventListener('focusout', () => { this.focus = null; this.update(); });
            this.refit = () => { if (this.target) { this.place(this.box(this.target), true); this.render(); } };
            window.addEventListener('resize', this.refit, { passive: true });
            if ('ResizeObserver' in window) {
                const ro = new ResizeObserver(this.refit);
                ro.observe(list);
                this.links.forEach((a) => ro.observe(a));
            }
            if (document.fonts) document.fonts.addEventListener('loadingdone', this.refit);
        }

        /* Phone menu only: press an item and slide up or down, and the bubble follows the finger from
           item to item; let go and it pops, then opens the item it is on. A touch stays captured by the
           item first pressed, so pointerover never reaches the others: the slide is followed with
           pointermove, and each move picks the row nearest the finger so the gaps do not drop the bubble. */
        slideTo(link) {
            this.drag = null;      // the press under way: { id, from, x, y, left }
            this.settle = null;    // the item let go on: { link, handled, until, timer }
            this.list.addEventListener('pointerdown', (e) => {
                if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || this.drag) return;
                if (this.settle && performance.now() < this.settle.until) return;   // one is already opening
                const a = link(e);
                if (!a) return;
                this.drag = { id: e.pointerId, from: a, x: e.clientX, y: e.clientY, left: false };
                this.press = a;
                this.el.classList.add('is-pressed');
                this.update();
            }, { passive: true });
            window.addEventListener('pointermove', (e) => {
                const d = this.drag;
                if (!d || e.pointerId !== d.id) return;
                const a = this.nearest(e.clientX, e.clientY);   // null well outside the list: the bubble fades
                if (a !== d.from) d.left = true;
                if (a !== this.press) { this.press = a; this.update(); }
            }, { passive: true });
            const end = (e) => {
                const d = this.drag;
                if (!d || e.pointerId !== d.id) return;
                this.drag = null;
                this.el.classList.remove('is-pressed');
                const a = e.type === 'pointerup' ? this.nearest(e.clientX, e.clientY) : null;
                if (!a) { this.press = null; this.update(); return; }   // let go outside, or cancelled: nothing opens
                if (a !== this.press) { this.press = a; this.update(); }
                this.pop();
                const settle = this.settle = { link: a, handled: false, until: performance.now() + 700, timer: 0 };
                const open = () => { if (settle.handled) return; settle.handled = true; a.click(); };
                // A plain tap gets the browser's own click. Anything that slid gets no click on that item,
                // so it is opened here, inside the pointerup, where it still counts as the user's press
                // (Resume opens a new tab). The timer covers a tap the browser decided was not a tap.
                if (a === d.from && !d.left && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10) settle.timer = setTimeout(open, 350);
                else open();
            };
            window.addEventListener('pointerup', end, { passive: true });
            window.addEventListener('pointercancel', end, { passive: true });
            // the browser's own click is let through once, for the item expected; any other is swallowed,
            // so an item never opens twice (clicks sent from here are not trusted and always pass)
            this.list.addEventListener('click', (e) => {
                const s = this.settle;
                const a = link(e);
                if (!e.isTrusted || !s || !a || performance.now() > s.until) return;
                if (!s.handled && a === s.link) { s.handled = true; clearTimeout(s.timer); return; }
                e.preventDefault();
                e.stopImmediatePropagation();
            }, true);
            // a long hold would bring up the link menu and cancel the slide
            this.list.addEventListener('contextmenu', (e) => { if (this.drag) e.preventDefault(); });
        }

        // The item on the row nearest the pointer, or null when it is well clear of the list
        nearest(x, y) {
            const rows = this.links.map((a) => [a, a.getBoundingClientRect()]).filter(([, r]) => r.height);
            if (!rows.length) return null;
            const lr = this.list.getBoundingClientRect();
            if (y < rows[0][1].top - 44 || y > rows[rows.length - 1][1].bottom + 44 || x < lr.left - 56 || x > lr.right + 56) return null;
            let best = null, far = Infinity;
            for (const [a, r] of rows) {
                const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
                if (d < far) { far = d; best = a; }
            }
            return best;
        }

        // Let go on an item: the bubble swells a little and springs back, with a quick brightening
        pop() {
            if (lessMotion()) return;
            this.el.classList.add('is-pop');
            clearTimeout(this.popping);
            this.popping = setTimeout(() => this.el.classList.remove('is-pop'), 180);
            this.a.to = 1;
            this.a.v = Math.max(0, this.a.v) + 3.2;
            this.wake();
        }

        // The menu closed: drop any press or slide still under way, and anything still waiting to open
        cancel() {
            this.drag = null;
            if (this.settle) { clearTimeout(this.settle.timer); this.settle.handled = true; }
            this.el.classList.remove('is-pressed');
            this.press = null;
            this.update();
        }

        box(a) {
            const lr = this.list.getBoundingClientRect();
            const r = a.getBoundingClientRect();
            if (!r.width) return null;
            const padX = typeof this.padX === 'function' ? this.padX(parseFloat(getComputedStyle(this.list).columnGap) || 0) : this.padX;
            return { l: r.left - lr.left - padX, r: r.right - lr.left + padX, t: r.top - lr.top - this.padY, b: r.bottom - lr.top + this.padY };
        }

        place(box, snap) {
            if (!box) return;
            if (snap) { this.L.snap(box.l); this.R.snap(box.r); this.T.snap(box.t); this.B.snap(box.b); return; }
            const right = box.l + box.r > this.L.x + this.R.x;
            const down = box.t + box.b > this.T.x + this.B.x;
            this.L.set(...(right ? TRAIL : LEAD)).to = box.l;
            this.R.set(...(right ? LEAD : TRAIL)).to = box.r;
            this.T.set(...(down ? TRAIL : LEAD)).to = box.t;
            this.B.set(...(down ? LEAD : TRAIL)).to = box.b;
        }

        update() {
            const t = this.press || this.hover || this.focus || this.active();
            const box = t && this.box(t);
            if (!box) {
                this.visible = false;
                this.target = null;
                this.el.classList.remove('is-visible');
                return;
            }
            if (t === this.target && this.visible) return;
            this.target = t;
            this.el.classList.toggle('is-accent', t.classList.contains('nav-resume-glow'));
            this.place(box, lessMotion() || !this.visible);
            if (!this.visible) {
                this.visible = true;
                this.el.classList.add('is-visible');
                if (lessMotion()) this.a.snap(1); else { this.a.snap(0.82); this.a.to = 1; }
            }
            this.wake();
        }

        render() {
            const w = Math.max(8, this.R.x - this.L.x), h = Math.max(8, this.B.x - this.T.x);
            this.el.style.width = `${w}px`;
            this.el.style.height = `${h}px`;
            this.el.style.transform = `translate(${this.L.x}px, ${this.T.x}px) scale(${this.a.x})`;
        }

        wake() {
            if (this.frame) return;
            this.last = performance.now();
            const tick = (time) => {
                const dt = Math.min(0.05, Math.max(0, (time - this.last) / 1000));
                this.last = time;
                let moving = false;
                for (const s of [this.L, this.R, this.T, this.B, this.a]) moving = s.step(dt) || moving;
                this.render();
                this.frame = moving ? requestAnimationFrame(tick) : 0;
            };
            this.render();
            this.frame = requestAnimationFrame(tick);
        }
    }

    const desktopList = document.querySelector('.nav-links');
    const mobileList = document.querySelector('.mobile-nav-links');
    const activeDesktop = () => (desktopList ? desktopList.querySelector('a.active') : null);
    if (desktopList) lenses.push(new Lens(desktopList, { padX: (gap) => Math.min(14, Math.max(6, gap / 2 - 3)), padY: 7, active: activeDesktop }));
    if (mobileList) {
        lenses.push(new Lens(mobileList, {
            padX: 22, padY: 2,
            active: () => null,
            slide: true,   // press and slide to choose; the header lens keeps plain hover and press
        }));
    }
    setInterval(() => {
        for (const lens of lenses) {
            if (!lens.visible || lens.frame || !lens.target) continue;
            const b = lens.box(lens.target);
            if (b && (Math.abs(b.l - lens.L.x) > 1 || Math.abs(b.r - lens.R.x) > 1 || Math.abs(b.t - lens.T.x) > 1)) {
                lens.place(b, lessMotion());
                lens.wake();
            }
        }
    }, 300);
    updateHeader();

    /* ---------------- Project picture lightbox ---------------- */
    /* One native dialog, opened by delegation so cards that firebase-live.js adds or replaces still work. */
    const lbSel = '.project-image-wrapper img.project-image';
    let lbDialog = null, lbImg = null, lbCap = null, lbOpener = null, lbPrevOverflow = '';
    const lbBuild = () => {
        lbDialog = document.createElement('dialog');
        lbDialog.className = 'lightbox';
        lbDialog.setAttribute('aria-label', 'Project picture');
        const fig = document.createElement('figure');
        lbImg = document.createElement('img');
        lbCap = document.createElement('figcaption');
        fig.append(lbImg, lbCap);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'lightbox-close';
        close.setAttribute('aria-label', 'Close picture');
        close.textContent = '×';
        lbDialog.append(fig, close);
        document.body.appendChild(lbDialog);
        /* A press anywhere except the caption closes it (backdrop clicks land on the dialog itself). */
        lbDialog.addEventListener('click', (e) => { if (e.target !== lbCap) lbDialog.close(); });
        lbDialog.addEventListener('close', () => {
            document.body.style.overflow = lbPrevOverflow;
            if (lbOpener && lbOpener.isConnected) lbOpener.focus({ preventScroll: true });
            lbOpener = null;
        });
    };
    const lbOpen = (img) => {
        if (!img.currentSrc && !img.src) return;
        if (!lbDialog) lbBuild();
        if (lbDialog.open) return;
        lbOpener = img;
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt || '';
        lbCap.textContent = img.alt || '';
        lbPrevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        lbDialog.showModal();
    };
    const lbPrep = (img) => {
        if (img.dataset.lb) return;
        img.dataset.lb = '1';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Open picture: ' + (img.alt || 'project'));
    };
    const lbPrepAll = () => document.querySelectorAll(lbSel).forEach(lbPrep);
    lbPrepAll();
    const lbGrid = document.querySelector('.projects-grid');
    if (lbGrid) new MutationObserver(lbPrepAll).observe(lbGrid, { childList: true, subtree: true });
    document.addEventListener('click', (e) => {
        const img = e.target.closest && e.target.closest(lbSel);
        if (!img || e.target.closest('a')) return;
        lbPrep(img);
        lbOpen(img);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const img = e.target.closest && e.target.closest(lbSel);
        if (!img || e.target !== img) return;
        e.preventDefault();
        lbOpen(img);
    });

    /* ---------------- Scroll progress bar ---------------- */
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.prepend(progress);
    const updateProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();

    /* ---------------- Retro mode ----------------
       Type 2002 (the year I was born), press my photo seven times, or press the Retro System button (phones only), and the
       whole site becomes a late-80s green terminal: a broken-CRT glitch, a short boot sequence, then the same pages through
       retro.css. The intro only skips with the S key. */
    const root = document.documentElement;
    const memory = {
        get() { try { return sessionStorage.getItem('retro') === '1'; } catch { return false; } },
        set(on) { try { sessionStorage.setItem('retro', on ? '1' : '0'); } catch { /* private mode: it just will not be remembered */ } },
    };
    const retroBtn = document.createElement('button');
    retroBtn.type = 'button';
    retroBtn.className = 'retro-btn';
    // with a keyboard the page just says how to get in (and out); phones get the button, pinned in retro mode so there is always a way out
    const retroHint = document.createElement('p');
    retroHint.className = 'retro-hint';
    (document.querySelector('.footer') ?? document.querySelector('.page') ?? document.body).append(retroBtn, retroHint);
    const label = (on) => {
        retroBtn.textContent = on ? 'Exit Retro System' : 'Retro System';
        retroBtn.setAttribute('aria-pressed', String(on));
        retroHint.textContent = `Type 2002 on your keyboard to ${on ? 'exit' : 'activate'} Retro System`;
    };

    function retroFont() {
        if (document.getElementById('retro-font')) return;
        const link = document.createElement('link');
        link.id = 'retro-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
        document.head.append(link);
    }

    // Run the typing again on whatever headings are on screen, so the switch is felt
    function retype() {
        document.querySelectorAll('.decode[data-ready]').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width && r.bottom > 0 && r.top < window.innerHeight && !el.closest('.mobile-menu')) decode(el);
        });
        lenses.forEach((lens) => lens.refit());
    }

    // The broken-CRT moment before the boot: the tube fights to find the signal, then the message tears through
    const GLITCH_MS = 1900;
    function glitch() {
        const cover = document.createElement('div');
        cover.className = 'glitch';
        cover.setAttribute('role', 'status');
        cover.setAttribute('aria-label', 'Activating retro protocol. Press S to skip.');
        const words = 'ACTIVATING RETRO PROTOCOL';
        cover.innerHTML = '<div class="glitch-roll" aria-hidden="true"></div>'
            + '<div class="glitch-inner" aria-hidden="true">'
            + `<p class="glitch-text" data-text="${words}">${words}</p>`
            + '<p class="glitch-sub">TIME BASE 2026 &gt;&gt; 2002</p>'
            + '<span class="glitch-bar"></span>'
            + '</div>'
            + '<span class="glitch-skip" aria-hidden="true">S - SKIP</span>';
        document.body.append(cover);
        return cover;
    }

    // The boot screen appends itself straight away (before its first pause), so it is there before the glitch leaves
    async function boot(pause) {
        const screen = document.createElement('div');
        screen.className = 'boot';
        screen.setAttribute('role', 'status');
        screen.setAttribute('aria-label', 'Retro mode starting. Press S to skip.');
        const text = document.createTextNode('');
        const cur = document.createElement('span');
        cur.className = 'cur';
        const hint = document.createElement('span');
        hint.className = 'boot-skip';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = 'S - SKIP';
        screen.append(text, cur, hint);
        document.body.append(screen);
        const line = async (s = '', ms = 110) => { text.data += s + '\n'; await pause(ms); };
        const type = async (s, per = 45) => { for (const ch of s) { text.data += ch; await pause(per); } };
        const now = new Date();
        const two = (n) => String(n).padStart(2, '0');
        const row = (a, b, c) => `| ${a.padEnd(14)} | ${b.padEnd(9)} | ${c.padEnd(4)} |`;
        const rule = '+----------------+-----------+------+';

        await line(`Arjun Terminal OS v20.02 ${two(now.getDate())}/${two(now.getMonth() + 1)}/1988`, 260);
        await line('<C> Copyright Arjunsoft 2002', 320);
        await line();
        await line('MEM CHECKSUM', 260);
        await line('65535K OK', 320);
        await line();
        await line('DETECTING PORTFOLIO', 160);
        for (let i = 0; i < 20; i++) { text.data += '#'; await pause(38); }
        await line('', 200);
        await line();
        await line('  MODULE           STATUS      PORT', 90);
        await line(rule, 60);
        for (const [a, b, c] of [['PROJECTS', 'LOADED', '01'], ['ABOUT', 'LOADED', '02'], ['EXPERIENCE', 'LOADED', '03'], ['SKILLS', 'LOADED', '04'], ['EDUCATION', 'LOADED', '05'], ['GALLERY', 'LOADED', '06'], ['CONTACT', 'ON-LINE', '07']]) {
            await line(row(a, b, c), 95);
        }
        await line(rule, 240);
        await line();
        await type('C:\\>');
        await pause(240);
        await type('portfolio.exe ', 60);
        const base = text.data;
        for (let i = 0; i < 12; i++) { text.data = base + '|/-\\'[i % 4]; await pause(85); }
        screen.remove();
    }

    // Glitch, then boot. Nothing but the S key skips it (one press skips both), and the listener goes when it ends
    async function intro() {
        let skipped = false;
        let wake = null;
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== 's' && e.key !== 'S')) return;
            skipped = true;
            if (wake) wake();
        };
        const pause = (ms) => (skipped ? Promise.resolve() : new Promise((resolve) => {
            const t = setTimeout(resolve, ms);
            wake = () => { clearTimeout(t); resolve(); };
        }));
        document.addEventListener('keydown', onKey);
        try {
            // the cover goes up first, and only then does the site turn retro underneath it
            const cover = glitch();
            root.classList.add('retro');
            window.scrollTo(0, 0);
            await pause(GLITCH_MS);
            const booting = boot(pause);
            cover.classList.add('out');
            setTimeout(() => cover.remove(), 200);
            await booting;
        } finally {
            document.removeEventListener('keydown', onKey);
        }
    }

    let switching = false;
    async function setRetro(on, withBoot = true) {
        // while the intro plays, another press or another 2002 does nothing
        if (switching) return;
        switching = true;
        try {
            memory.set(on);
            label(on);
            if (on) {
                retroFont();
                if (withBoot && !lessMotion()) await intro();
                root.classList.add('retro');
                window.scrollTo(0, 0);
            } else {
                root.classList.remove('retro');
            }
        } finally {
            switching = false;
        }
        retype();
    }
    retroBtn.addEventListener('click', () => setRetro(!root.classList.contains('retro')));
    // the code: 2, 0, 0, 2 typed anywhere on the page
    let typedDigits = '';
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || !/^\d$/.test(e.key)) { if (e.key.length === 1) typedDigits = ''; return; }
        typedDigits = (typedDigits + e.key).slice(-4);
        if (typedDigits === '2002') { typedDigits = ''; setRetro(!root.classList.contains('retro')); }
    });
    // the other way in, for phones: press my photo seven times in a row (works in both modes)
    const photo = document.querySelector('.disk');
    if (photo) {
        let presses = 0;
        let lastPress = 0;
        photo.addEventListener('click', () => {
            const t = performance.now();
            presses = t - lastPress < 1500 ? presses + 1 : 1;
            lastPress = t;
            if (presses >= 7) { presses = 0; setRetro(!root.classList.contains('retro')); }
        });
    }
    // a page opened while retro is on stays retro, without the boot sequence again
    if (root.classList.contains('retro') || memory.get()) { root.classList.add('retro'); retroFont(); }
    label(root.classList.contains('retro'));

    /* ---------------- The sky ----------------
       Still stars that twinkle, a few drifting nodes joined by faint maroon
       lines, and the odd meteor. Under reduced motion it is drawn once. */
    const canvas = document.getElementById('sky');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let w = 0, h = 0, stars = [], nodes = [], meteors = [], frame = null, meteorTimer = null;
        const mouse = { x: null, y: null };
        const STAR_COLOURS = ['255,255,255', '224,240,255', '255,240,224', '255,221,187', '255,205,210'];
        const NODE = '215,38,61';

        function build() {
            w = window.innerWidth; h = window.innerHeight;
            canvas.width = w * dpr; canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.min(240, Math.floor((w * h) / 6500));
            stars = []; nodes = [];
            for (let i = 0; i < count; i++) {
                if (Math.random() > 0.3) {
                    stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3, o: Math.random() * 0.8 + 0.2,
                        tw: (Math.random() * 0.012 + 0.004) * (Math.random() > 0.5 ? 1 : -1), c: STAR_COLOURS[Math.floor(Math.random() * STAR_COLOURS.length)] });
                } else {
                    nodes.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.9, o: Math.random() * 0.5 + 0.35,
                        vx: (Math.random() - 0.5) * 0.36, vy: (Math.random() - 0.5) * 0.36 });
                }
            }
        }

        function draw(move) {
            ctx.clearRect(0, 0, w, h);
            for (const s of stars) {
                if (move) { s.o += s.tw; if (s.o > 1 || s.o < 0.15) s.tw *= -1; }
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832);
                ctx.fillStyle = `rgba(${s.c},${Math.max(0, Math.min(1, s.o))})`; ctx.fill();
            }
            for (const n of nodes) {
                if (move) {
                    n.x += n.vx; n.y += n.vy;
                    if (mouse.x !== null) {
                        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
                        if (d < 150 && d > 0) { const f = (150 - d) / 150; n.x += (dx / d) * f * 1.4; n.y += (dy / d) * f * 1.4; }
                    }
                    if (n.x < 0) n.x = w; else if (n.x > w) n.x = 0;
                    if (n.y < 0) n.y = h; else if (n.y > h) n.y = 0;
                }
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832);
                ctx.fillStyle = `rgba(255,120,138,${n.o})`; ctx.fill();
            }
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
                    if (Math.abs(dx) > 150 || Math.abs(dy) > 150) continue;
                    const d = Math.hypot(dx, dy);
                    if (d < 150) {
                        ctx.strokeStyle = `rgba(${NODE},${(1 - d / 150) * 0.42})`;
                        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
                    }
                }
            }
            meteors = meteors.filter((m) => m.o > 0 && m.y < h + 60 && m.x > -60);
            for (const m of meteors) {
                const tx = m.x - m.vx * 9, ty = m.y - m.vy * 9;
                const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
                grad.addColorStop(0, `rgba(255,255,255,${m.o})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
                m.x += m.vx; m.y += m.vy; m.o -= 0.006;
            }
        }

        function loop() { if (!document.documentElement.classList.contains('retro')) draw(true); frame = requestAnimationFrame(loop); }

        function sync() {
            cancelAnimationFrame(frame); frame = null;
            clearInterval(meteorTimer); meteorTimer = null;
            if (lessMotion() || document.hidden) { meteors = []; draw(false); return; }
            meteorTimer = setInterval(() => {
                const n = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < n; i++) setTimeout(() => meteors.push({ x: Math.random() * w * 1.4, y: -40, vx: -(Math.random() * 7 + 5), vy: Math.random() * 7 + 5, o: 1 }), Math.random() * 1800);
            }, 32000);
            loop();
        }

        build();
        sync();
        let resizeTimer;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { build(); if (!frame) draw(false); }, 160); });
        window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') { mouse.x = e.clientX; mouse.y = e.clientY; } });
        document.addEventListener('pointerleave', () => { mouse.x = mouse.y = null; });
        document.addEventListener('visibilitychange', sync);
        motionQuery.addEventListener('change', sync);
    }

    motionQuery.addEventListener('change', () => {
        if (!lessMotion()) return;
        document.querySelectorAll('.decode[data-ready]').forEach((el) => { clearInterval(timers.get(el)); el.lastElementChild.textContent = el.dataset.text; });
        lenses.forEach((lens) => { if (lens.target) { lens.place(lens.box(lens.target), true); lens.a.snap(1); lens.render(); } });
    });
})();
