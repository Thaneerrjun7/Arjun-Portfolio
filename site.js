/*
   Arjun Shanker - portfolio script.
   The sky, the Tamil-to-English decode text, scroll reveals, the header and its glass lens,
   and the intro video.
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
    const GLYPHS = [...'அஆஇஈஉஊஎஏஐஒஓகஙசஞடணதநபமயரலவழளறன'];
    const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const scramble = (chars) => chars.map((c) => (c === ' ' ? ' ' : pick()));
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
        const typeMs = clamp(n * TIMING.typePerChar, TIMING.typeMin, TIMING.typeMax);
        const settleMs = clamp(n * TIMING.settlePerChar, TIMING.settleMin, TIMING.settleMax);
        let tamil = scramble(chars);
        let tick = 0;
        const started = performance.now();
        paint(out, '', '');
        const id = setInterval(() => {
            const t = performance.now() - started;
            if (t < typeMs) {                                   // typing
                paint(out, '', tamil.slice(0, Math.ceil((t / typeMs) * n)).join(''));
            } else if (t < typeMs + TIMING.hold) {              // holding, cursor blinking
                paint(out, '', tamil.join(''), Math.floor((t - typeMs) / TIMING.blink) % 2 === 1);
            } else {                                            // settling
                const settled = Math.floor(((t - typeMs - TIMING.hold) / settleMs) * (n + 1));
                if (settled >= n) {
                    // done: the cursor blinks a few more times at the end of the line, then leaves
                    clearInterval(id);
                    const cur = document.createElement('span');
                    cur.className = 'cur blink';
                    cur.addEventListener('animationend', () => cur.remove());
                    out.replaceChildren(text, cur);
                    return;
                }
                if (tick++ % TIMING.flicker === 0) tamil = scramble(chars);
                paint(out, chars.slice(0, settled).join(''), tamil.slice(settled).join(''));
            }
        }, TIMING.tick);
        timers.set(el, id);
    }

    // Headings everywhere decode once, the first time they come into view
    const AUTO = '.hero-name, h2.title, .contact h2, .page h1, .page h2, .page h3, .project-title, .xp-role, .skill-row h3, .edu-item h3, .certs h3, .status-title';
    const decodeSeen = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            decodeSeen.unobserve(entry.target);
            decode(entry.target);
        }
    }, { threshold: 0.5 });
    const decodeWhenSeen = (el) => { setup(el); decodeSeen.observe(el); };
    document.querySelectorAll(AUTO).forEach((el) => {
        const target = el.querySelector(':scope > .decode') ?? el;
        if (target.children.length === 0) decodeWhenSeen(target);
    });

    // Header links decode once the fonts are in, with their width held so the bar does not shuffle
    const navWords = [...document.querySelectorAll('.nav-links .decode')];
    navWords.forEach(setup);
    const startNav = () => navWords.forEach((el, i) => {
        if (lessMotion()) return;
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

    function setMenu(open) {
        if (!navToggle || !mobileMenu) return;
        navToggle.classList.toggle('active', open);
        mobileMenu.classList.toggle('active', open);
        navToggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
        // every item decodes from Tamil each time the menu opens
        if (open) mobileMenu.querySelectorAll('.decode').forEach((el, i) => {
            setup(el);
            if (lessMotion()) return;
            wait(el.lastElementChild, el.dataset.text);
            setTimeout(() => decode(el), 80 + i * 90);
        });
    }
    if (navToggle && mobileMenu) {
        mobileMenu.querySelectorAll('.decode').forEach(setup);
        navToggle.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('active')));
        mobileMenu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
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
        constructor(list, { padX, padY, active }) {
            Object.assign(this, { list, padX, padY, active, hover: null, focus: null, press: null, target: null, visible: false, frame: 0, last: 0 });
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
            list.addEventListener('pointerdown', (e) => { const a = link(e); if (!a) return; this.press = a; this.el.classList.add('is-pressed'); this.update(); }, { passive: true });
            const release = () => { if (!this.press) return; this.el.classList.remove('is-pressed'); setTimeout(() => { this.press = null; this.update(); }, 260); };
            window.addEventListener('pointerup', release, { passive: true });
            window.addEventListener('pointercancel', release, { passive: true });
            list.addEventListener('focusin', (e) => { const a = link(e); if (a && a.matches(':focus-visible')) { this.focus = a; this.update(); } });
            list.addEventListener('focusout', () => { this.focus = null; this.update(); });
            window.addEventListener('resize', () => { if (this.target) { this.place(this.box(this.target), true); this.render(); } }, { passive: true });
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
            active: () => {
                const href = activeDesktop()?.getAttribute('href');
                return href ? [...mobileList.querySelectorAll('a')].find((m) => m.getAttribute('href') === href) ?? null : null;
            },
        }));
    }
    updateHeader();

    /* ---------------- Intro video: only ever plays when asked ---------------- */
    const dialog = document.getElementById('intro-dialog');
    if (dialog) {
        const video = dialog.querySelector('video');
        document.querySelectorAll('[data-open-intro]').forEach((btn) => btn.addEventListener('click', () => {
            if (typeof dialog.showModal !== 'function') { window.open(video.currentSrc || video.querySelector('source').src, '_blank'); return; }
            dialog.showModal();
            video.currentTime = 0;
            video.play().catch(() => {});
        }));
        dialog.addEventListener('close', () => video.pause());
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    }

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

        function loop() { draw(true); frame = requestAnimationFrame(loop); }

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
