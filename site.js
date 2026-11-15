/*
   Arjun Shanker - portfolio script.
   The sky, the Tamil-to-English decode text, scroll reveals, the menu and the intro video.
*/
(() => {
    'use strict';

    // The flag is cached: reading .matches on every frame can swallow the query's change event in Chrome
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;
    motionQuery.addEventListener('change', (e) => { reduced = e.matches; });
    const lessMotion = () => reduced;

    /* ---------------- Tamil decode text ----------------
       Each .decode element starts as its Tamil word (data-ta), then resolves
       left to right into the English it holds, with Tamil letters flickering
       through the part that has not settled yet. */
    const GLYPHS = [...'அஆஇஈஉஊஎஏஐஒஓகஙசஞடணதநபமயரலவழளறன'];
    const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const timers = new WeakMap();

    function setup(el) {
        if (el.dataset.ready) return;
        el.dataset.ready = '1';
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        el.dataset.text = text;
        el.textContent = '';
        const hidden = document.createElement('span');
        hidden.className = 'sr-only';
        hidden.textContent = text;
        const out = document.createElement('span');
        out.setAttribute('aria-hidden', 'true');
        el.append(hidden, out);
        if (lessMotion() || !el.dataset.ta) out.textContent = text;
        else showTamil(out, el.dataset.ta);
    }

    function showTamil(out, word) {
        const g = document.createElement('span');
        g.className = 'g';
        g.textContent = word;
        out.replaceChildren(g);
    }

    function render(out, text, settled, scramble) {
        const frag = document.createDocumentFragment();
        if (settled > 0) frag.append(text.slice(0, settled));
        if (settled < text.length) {
            const g = document.createElement('span');
            g.className = 'g';
            g.textContent = scramble;
            frag.append(g);
        }
        out.replaceChildren(frag);
    }

    function decode(el, to, hold = 380) {
        setup(el);
        const out = el.lastElementChild;
        const text = to ?? el.dataset.text;
        el.dataset.text = text;
        el.firstElementChild.textContent = text;
        clearInterval(timers.get(el));
        if (lessMotion()) {
            out.textContent = text;
            return;
        }
        const chars = [...text];
        const started = performance.now();
        const span = Math.min(1500, 260 + chars.length * 46);
        let tick = 0;
        let noise = chars.map((c) => (c === ' ' ? ' ' : pick()));
        const id = setInterval(() => {
            const t = performance.now() - started - hold;
            if (t < 0) return;
            const settled = Math.min(chars.length, Math.floor((t / span) * (chars.length + 1)));
            if (tick++ % 2 === 0) noise = chars.map((c) => (c === ' ' ? ' ' : pick()));
            // the unsettled tail is kept short so a long line does not jump about
            const tail = noise.slice(settled, settled + 7).join('');
            render(out, chars.slice(0, settled).join(''), settled, settled < chars.length ? tail : '');
            if (settled >= chars.length) {
                out.textContent = text;
                clearInterval(id);
            }
        }, 34);
        timers.set(el, id);
    }

    document.querySelectorAll('.decode').forEach(setup);

    const decodeSeen = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            decodeSeen.unobserve(entry.target);
            decode(entry.target);
        }
    }, { threshold: 0.4 });
    document.querySelectorAll('.decode:not([data-rotate])').forEach((el) => decodeSeen.observe(el));

    // Links that decode again when pointed at
    document.querySelectorAll('[data-redecode]').forEach((link) => {
        const el = link.querySelector('.decode');
        if (!el) return;
        link.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch' || lessMotion()) return;
            showTamil(el.lastElementChild, el.dataset.ta);
            decode(el, undefined, 120);
        });
    });

    // The hero's rotating second line
    const rotator = document.querySelector('.decode[data-rotate]');
    if (rotator) {
        const words = JSON.parse(rotator.dataset.rotate);
        const tamil = JSON.parse(rotator.dataset.tamil || '[]');
        let index = 0;
        const show = () => {
            if (tamil[index] && !lessMotion()) showTamil(rotator.lastElementChild, tamil[index]);
            decode(rotator, words[index], 520);
        };
        setTimeout(show, 700);
        setInterval(() => {
            if (document.hidden || lessMotion()) return;
            index = (index + 1) % words.length;
            show();
        }, 4200);
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
    // firebase-live.js adds cards after load and hands them over here
    window.siteFX = { observe };

    /* ---------------- Section highlight in the rail ---------------- */
    const navLinks = new Map([...document.querySelectorAll('.rail-nav a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]));
    if (navLinks.size) {
        const spy = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                navLinks.forEach((a) => a.classList.remove('active'));
                navLinks.get(entry.target.id)?.classList.add('active');
            }
        }, { rootMargin: '-45% 0px -50% 0px' });
        // every section is watched, so the highlight clears in sections the rail does not list
        document.querySelectorAll('main section[id]').forEach((section) => spy.observe(section));
    }

    // The status pill steps aside once the page is scrolled (wide screens only, see site.css)
    const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 140);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------------- Menu (small screens) ---------------- */
    const menuBtn = document.querySelector('.menu-btn');
    const menu = document.getElementById('menu');
    if (menuBtn && menu) {
        const setMenu = (open) => {
            document.body.classList.toggle('menu-open', open);
            menuBtn.setAttribute('aria-expanded', String(open));
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
        menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
        window.matchMedia('(min-width: 961px)').addEventListener('change', () => setMenu(false));
    }

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
        document.querySelectorAll('.decode').forEach((el) => { clearInterval(timers.get(el)); el.lastElementChild.textContent = el.dataset.text; });
    });
})();
