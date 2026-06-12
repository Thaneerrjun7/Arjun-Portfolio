/* ============================================================
   ARJUN SHANKER PORTFOLIO — JavaScript
   Scroll animations, particle canvas, 3D tilt, typing effect,
   stats counter, Konami code, and more
   ============================================================ */

// Handle scroll restoration
// If it's a page reload, go to top. If it's a back button navigation, let the browser restore scroll position natively.
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'auto';
}
const navEntries = performance.getEntriesByType('navigation');
if (navEntries.length > 0 && navEntries[0].type === 'reload') {
    // Small delay to ensure it overrides any browser caching on reload
    setTimeout(() => window.scrollTo(0, 0), 10);
}

document.addEventListener('DOMContentLoaded', () => {


    // ======================== SCROLL PROGRESS BAR ========================
    const scrollProgress = document.getElementById('scroll-progress');

    function updateScrollProgress() {
        if (!scrollProgress) return;
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        scrollProgress.style.width = progress + '%';
    }

    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    // ======================== NAVBAR ========================
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav-links a');

    function updateNavbar() {
        if (!navbar) return;
        if (window.scrollY > 60) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();

    // Mobile menu toggle
    if (navToggle && mobileMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Active nav link on scroll
    const sections = document.querySelectorAll('.section[id]');

    function updateActiveNavLink() {
        const scrollY = window.scrollY + 200;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav-links a[data-section="${id}"]`);
            if (link) {
                if (scrollY >= top && scrollY < top + height) {
                    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    }

    window.addEventListener('scroll', updateActiveNavLink, { passive: true });

    // ======================== TYPING ANIMATION ========================
    const roles = [
        'Software Engineer',
        'UI/UX Designer',
        'Website Developer',
        'AI Engineer',
        'Flutter Developer',
        'Solutions Engineer',
        'Full-Stack Developer'
    ];

    const typedElement = document.getElementById('typed-role');
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 80;

    function typeRole() {
        if (!typedElement) return;
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            typedElement.textContent = currentRole.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 40;
        } else {
            typedElement.textContent = currentRole.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 80;
        }

        if (!isDeleting && charIndex === currentRole.length) {
            typingSpeed = 2000; // Pause at end
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            typingSpeed = 400; // Pause before next word
        }

        setTimeout(typeRole, typingSpeed);
    }

    typeRole();

    // ======================== SCROLL ANIMATIONS (Intersection Observer) ========================
    const animatedElements = document.querySelectorAll('.animate-on-scroll');

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const delay = parseInt(el.dataset.delay) || 0;

                setTimeout(() => {
                    el.classList.add('visible');
                }, delay);

                // Don't unobserve — we want one-time trigger
                observer.unobserve(el);
            }
        });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));

    // ======================== STATS COUNTER ========================
    const statNumbers = document.querySelectorAll('.stat-number');

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                animateCounter(el, target);
                statsObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statsObserver.observe(el));

    function animateCounter(element, target) {
        const duration = 2000;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out quart
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = Math.round(eased * target);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ======================== LANGUAGE BARS ========================
    const barFills = document.querySelectorAll('.bar-fill');

    const barsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const width = el.dataset.width;
                el.style.setProperty('--target-width', width + '%');
                setTimeout(() => {
                    el.classList.add('animated');
                }, 200);
                barsObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    barFills.forEach(el => barsObserver.observe(el));

    // ======================== LIQUID GLASS PROFILE EFFECT ========================
    const profileGlass = document.querySelector('.hero-profile-glass');
    if (profileGlass) {
        profileGlass.addEventListener('mousemove', (e) => {
            const rect = profileGlass.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Inverted tilt: Mouse "pushes down" on the element, tilting it away
            const rotateX = ((y - centerY) / centerY) * -18; // Max 18 deg
            const rotateY = ((x - centerX) / centerX) * -18; // Max 18 deg

            profileGlass.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

            // Move the inner liquid shine dynamically based on mouse
            const shine = profileGlass.querySelector('.glass-shine-moving');
            if (shine) {
                // Move shine opposite to mouse for depth
                const shineX = ((rect.width - x) / rect.width) * 100;
                const shineY = ((rect.height - y) / rect.height) * 100;
                shine.style.transform = `translate(${shineX - 50}%, ${shineY - 50}%)`;
                shine.style.opacity = '1';
            }
        });

        profileGlass.addEventListener('mouseleave', () => {
            profileGlass.style.transform = 'rotateX(0) rotateY(0) scale3d(1, 1, 1)';
            profileGlass.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease';

            const shine = profileGlass.querySelector('.glass-shine-moving');
            if (shine) {
                shine.style.opacity = '0';
                shine.style.transform = 'translate(0, 0)';
            }

            setTimeout(() => {
                profileGlass.style.transition = 'transform 0.1s linear, box-shadow 0.4s ease';
            }, 600);
        });

        profileGlass.addEventListener('mouseenter', () => {
            profileGlass.style.transition = 'transform 0.1s linear, box-shadow 0.4s ease';
        });
    }

    // ======================== 3D TILT EFFECT (Project Cards) ========================
    const tiltCards = document.querySelectorAll('.tilt-card');

    tiltCards.forEach(card => {
        const inner = card.querySelector('.project-card-inner');

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -6;
            const rotateY = ((x - centerX) / centerX) * 6;

            inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

            // Move shine
            const shine = card.querySelector('.project-shine');
            if (shine) {
                const shineX = (x / rect.width) * 100;
                const shineY = (y / rect.height) * 100;
                shine.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.08) 0%, transparent 60%)`;
                shine.style.opacity = '1';
            }
        });

        card.addEventListener('mouseleave', () => {
            inner.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
            inner.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

            const shine = card.querySelector('.project-shine');
            if (shine) {
                shine.style.opacity = '0';
            }

            setTimeout(() => {
                inner.style.transition = '';
            }, 600);
        });

        card.addEventListener('mouseenter', () => {
            inner.style.transition = '';
        });
    });

    // ======================== PARTICLE CONSTELLATION ========================
    const canvas = document.getElementById('particle-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouse = { x: null, y: null };
        let animationId;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class Particle {
            constructor() {
                // Star types (colors)
                const starColors = [
                    'rgba(255, 255, 255', // White (A)
                    'rgba(224, 240, 255', // Blue-white (B)
                    'rgba(255, 240, 224', // Yellow-white (F)
                    'rgba(255, 221, 187', // Orange (K)
                    'rgba(170, 204, 255'  // Blue (O)
                ];
                this.colorBase = starColors[Math.floor(Math.random() * starColors.length)];

                // 60% static background stars, 40% moving constellation nodes
                this.isStatic = Math.random() > 0.4;

                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;

                if (this.isStatic) {
                    this.size = Math.random() * 2 + 0.5; // Bigger static stars
                    this.opacity = Math.random() * 0.9 + 0.3; // Much brighter
                    this.speedX = 0;
                    this.speedY = 0;
                    this.twinkleSpeed = (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1); // More noticeable twinkle
                } else {
                    this.size = Math.random() * 2.5 + 1.2; // Larger interactive nodes
                    this.opacity = Math.random() * 0.6 + 0.3;
                    this.speedX = (Math.random() - 0.5) * 0.5;
                    this.speedY = (Math.random() - 0.5) * 0.5;
                    this.colorBase = 'rgba(41, 151, 255'; // Constellation nodes stay blueish
                }
            }

            update() {
                if (this.isStatic) {
                    // Twinkle effect
                    this.opacity += this.twinkleSpeed;
                    if (this.opacity > 1 || this.opacity < 0.1) this.twinkleSpeed *= -1;
                    return; // Static stars don't move or interact
                }

                this.x += this.speedX;
                this.y += this.speedY;

                // Mouse interaction for moving nodes
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {
                        const force = (150 - dist) / 150;
                        this.x += (dx / dist) * force * 1.5;
                        this.y += (dy / dist) * force * 1.5;
                    }
                }

                // Wrap around
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `${this.colorBase}, ${this.opacity})`;

                // Add glow to brighter stars
                if (this.opacity > 0.5) { // Lower threshold, more stars glow
                    ctx.shadowBlur = 15; // Bigger and stronger glow
                    ctx.shadowColor = `${this.colorBase}, 1)`;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fill();
            }
        }

        // Create more particles for a denser starfield
        const particleCount = Math.min(250, Math.floor((canvas.width * canvas.height) / 6000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        function drawConnections() {
            ctx.shadowBlur = 0; // Reset shadow for lines
            for (let i = 0; i < particles.length; i++) {
                if (particles[i].isStatic) continue; // Only connect moving nodes

                for (let j = i + 1; j < particles.length; j++) {
                    if (particles[j].isStatic) continue;

                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 160) {
                        const opacity = (1 - dist / 160) * 0.4; // Brighter lines
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(41, 151, 255, ${opacity})`;
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }
                }
            }
        }

        // ======================== METEOR SHOWER ========================
        class Meteor {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * canvas.width * 1.5; // Start far right
                this.y = -50; // Start above screen
                this.size = Math.random() * 2 + 1;
                this.speedX = -Math.random() * 8 - 5; // Fast diagonal down-left
                this.speedY = Math.random() * 8 + 5;
                this.opacity = 1;
                this.tail = [];
                this.active = true;
            }
            update() {
                if (!this.active) return;
                this.tail.push({ x: this.x, y: this.y });
                if (this.tail.length > 20) this.tail.shift();

                this.x += this.speedX;
                this.y += this.speedY;
                this.opacity -= 0.005; // Fade out gradually

                if (this.y > canvas.height + 50 || this.x < -50 || this.opacity <= 0) {
                    this.active = false;
                }
            }
            draw() {
                if (!this.active) return;

                // Draw tail
                if (this.tail.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    for (let i = this.tail.length - 1; i >= 0; i--) {
                        ctx.lineTo(this.tail[i].x, this.tail[i].y);
                    }
                    const gradient = ctx.createLinearGradient(this.x, this.y, this.tail[0].x, this.tail[0].y);
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = this.size;
                    ctx.stroke();
                }

                // Draw meteor head
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'white';
                ctx.fill();
                ctx.shadowBlur = 0; // reset
            }
        }

        let meteors = [];
        function triggerMeteorShower() {
            // Spawn 3-6 meteors
            const count = Math.floor(Math.random() * 4) + 3;
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    meteors.push(new Meteor());
                }, Math.random() * 2000); // Stagger over 2 seconds
            }
        }

        // Trigger meteor shower every 35 seconds
        setInterval(triggerMeteorShower, 35000);

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            drawConnections();

            // Update and draw meteors
            meteors = meteors.filter(m => m.active);
            meteors.forEach(m => {
                m.update();
                m.draw();
            });

            animationId = requestAnimationFrame(animateParticles);
        }

        // Start animation globally
        animateParticles();
    }

    // ======================== KONAMI CODE EASTER EGG ========================
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
        if (e.code === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                triggerEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });

    function triggerEasterEgg() {
        const overlay = document.getElementById('easter-egg');
        overlay.classList.add('active');

        // Create confetti
        createConfetti();

        // Close on click
        overlay.addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        // Auto close after 5s
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 5000);
    }

    function createConfetti() {
        const colors = ['#2997ff', '#bf5af2', '#ff6723', '#30d158', '#ff375f', '#ffd60a'];
        const overlay = document.getElementById('easter-egg');

        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
                opacity: ${Math.random() * 0.8 + 0.2};
            `;
            overlay.appendChild(confetti);

            setTimeout(() => confetti.remove(), 5000);
        }

        // Add confetti animation
        if (!document.getElementById('confetti-style')) {
            const style = document.createElement('style');
            style.id = 'confetti-style';
            style.textContent = `
                @keyframes confetti-fall {
                    0% { transform: translateY(0) rotate(0deg); }
                    100% { transform: translateY(100vh) rotate(${Math.random() * 720}deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ======================== SMOOTH SCROLL ========================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
                const targetPosition = target.offsetTop - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ======================== HERO INTRO VIDEO ========================
    const heroVideoPlayer = document.getElementById('hero-video-player');
    const heroVideoProgressBar = document.getElementById('hero-video-progress-bar');
    const heroVideoReplayOverlay = document.getElementById('hero-video-replay-overlay');
    const heroVideoReplayBtn = document.getElementById('hero-video-replay');
    const heroVideoSoundBtn = document.getElementById('hero-video-sound');
    const soundIconOff = document.getElementById('sound-icon-off');
    const soundIconOn = document.getElementById('sound-icon-on');
    let videoProgressRAF = null;

    function updateSoundIcon() {
        if (!heroVideoPlayer || !soundIconOff || !soundIconOn) return;
        if (heroVideoPlayer.muted) {
            soundIconOff.style.display = '';
            soundIconOn.style.display = 'none';
        } else {
            soundIconOff.style.display = 'none';
            soundIconOn.style.display = '';
        }
    }

    function playHeroVideo() {
        if (!heroVideoPlayer) return;
        // Hide replay overlay
        if (heroVideoReplayOverlay) heroVideoReplayOverlay.classList.remove('visible');
        heroVideoPlayer.currentTime = 0;
        
        // Attempt to play (browser may block if unmuted)
        heroVideoPlayer.play().catch(() => {
            // Autoplay with sound blocked by browser policy.
            // Fallback: mute the video and try playing again so the user at least sees the video.
            heroVideoPlayer.muted = true;
            updateSoundIcon();
            heroVideoPlayer.play().catch(() => {
                // If even muted autoplay fails (e.g. strict low-power mode), show replay button
                showReplayOverlay();
            });
        });
        updateVideoProgress();
    }

    function showReplayOverlay() {
        if (heroVideoReplayOverlay) {
            heroVideoReplayOverlay.classList.add('visible');
        }
        if (heroVideoProgressBar) heroVideoProgressBar.style.width = '100%';
        if (videoProgressRAF) cancelAnimationFrame(videoProgressRAF);
    }

    function updateVideoProgress() {
        if (!heroVideoPlayer || !heroVideoProgressBar) return;
        const progress = (heroVideoPlayer.currentTime / heroVideoPlayer.duration) * 100;
        heroVideoProgressBar.style.width = (isNaN(progress) ? 0 : progress) + '%';

        if (!heroVideoPlayer.paused && !heroVideoPlayer.ended) {
            videoProgressRAF = requestAnimationFrame(updateVideoProgress);
        }
    }

    // Video ended → show replay overlay
    if (heroVideoPlayer) {
        heroVideoPlayer.addEventListener('ended', () => {
            showReplayOverlay();
        });
    }

    // Replay button click
    if (heroVideoReplayBtn) {
        heroVideoReplayBtn.addEventListener('click', () => {
            playHeroVideo();
        });
    }

    // Sound toggle
    if (heroVideoSoundBtn && heroVideoPlayer) {
        heroVideoSoundBtn.addEventListener('click', () => {
            heroVideoPlayer.muted = !heroVideoPlayer.muted;
            updateSoundIcon();
        });
    }

    // ======================== ENTER SITE OVERLAY & BLACK HOLE ========================
    const enterOverlay = document.getElementById('enter-overlay');
    const enterBtn = document.getElementById('enter-btn');
    const bhCanvas = document.getElementById('blackhole-canvas');

    // Check if user has already entered the site this session
    if (sessionStorage.getItem('hasEnteredPortfolio') === 'true' && enterOverlay) {
        enterOverlay.remove();
        document.body.style.overflow = '';
        
        // Ensure video still attempts to play (muted) if we skipped the overlay
        if (heroVideoPlayer) {
            heroVideoPlayer.muted = true;
            updateSoundIcon();
            playHeroVideo();
        }
    } else if (enterOverlay && enterBtn && bhCanvas) {
        // Prevent body scrolling while overlay is active
        document.body.style.overflow = 'hidden';

        const bhCtx = bhCanvas.getContext('2d');
        let bhWidth, bhHeight, centerX, centerY;
        let particles = [];
        let animationId;
        let isExpanding = false;
        let blackHoleRadius = 60;

        function resizeBhCanvas() {
            bhWidth = bhCanvas.width = window.innerWidth;
            bhHeight = bhCanvas.height = window.innerHeight;
            centerX = bhWidth / 2;
            centerY = bhHeight / 2;
        }

        window.addEventListener('resize', resizeBhCanvas);
        resizeBhCanvas();

        class BhParticle {
            constructor() {
                this.reset();
            }
            reset() {
                this.angle = Math.random() * Math.PI * 2;
                this.distance = Math.random() * (Math.max(bhWidth, bhHeight)) + 100;
                this.speed = (Math.random() * 0.02 + 0.005);
                this.size = Math.random() * 2 + 0.5;
                this.color = `hsla(${200 + Math.random() * 60}, 100%, 80%, ${Math.random() * 0.8 + 0.2})`;
            }
            update() {
                if (isExpanding) return; // Freeze particles during expansion
                this.angle -= this.speed; // spiral direction
                this.distance -= this.distance * 0.01; // pull inward
                if (this.distance < blackHoleRadius) {
                    this.reset();
                }
            }
            draw() {
                const x = centerX + Math.cos(this.angle) * this.distance;
                const y = centerY + Math.sin(this.angle) * this.distance;
                
                // Stretch particles as they get closer (spaghettification)
                const stretch = Math.max(1, 100 / Math.max(1, this.distance - blackHoleRadius));

                bhCtx.save();
                bhCtx.translate(x, y);
                bhCtx.rotate(this.angle + Math.PI / 2);
                bhCtx.beginPath();
                bhCtx.fillStyle = this.color;
                bhCtx.arc(0, 0, this.size, 0, Math.PI * 2);
                bhCtx.fill();
                
                // Trajectory tail
                bhCtx.beginPath();
                bhCtx.strokeStyle = this.color;
                bhCtx.lineWidth = this.size;
                bhCtx.moveTo(0, 0);
                bhCtx.lineTo(0, stretch * 2);
                bhCtx.stroke();
                
                bhCtx.restore();
            }
        }

        for (let i = 0; i < 300; i++) {
            particles.push(new BhParticle());
        }

        function animateBlackHole() {
            if (!enterOverlay.parentElement) return; // Stop if removed

            bhCtx.fillStyle = 'rgba(5, 10, 21, 0.3)'; // Trail effect
            bhCtx.fillRect(0, 0, bhWidth, bhHeight);

            // Draw Accretion Disk Glow
            const gradient = bhCtx.createRadialGradient(centerX, centerY, blackHoleRadius, centerX, centerY, blackHoleRadius * 4);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.1, 'rgba(41, 151, 255, 0.6)');
            gradient.addColorStop(0.4, 'rgba(41, 151, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            bhCtx.fillStyle = gradient;
            bhCtx.beginPath();
            bhCtx.arc(centerX, centerY, blackHoleRadius * 4, 0, Math.PI * 2);
            bhCtx.fill();

            // Draw Event Horizon (Pure Black)
            bhCtx.fillStyle = '#000000';
            bhCtx.beginPath();
            bhCtx.arc(centerX, centerY, blackHoleRadius, 0, Math.PI * 2);
            bhCtx.fill();

            // Draw Particles
            if (!isExpanding) {
                particles.forEach(p => {
                    p.update();
                    p.draw();
                });
            }

            // Expansion logic for cinematic transition
            if (isExpanding) {
                blackHoleRadius += (blackHoleRadius * 0.1) + 2;
                if (blackHoleRadius > Math.max(bhWidth, bhHeight) * 1.5) {
                    // Screen is black, now trigger fade out
                    enterOverlay.classList.add('hidden');
                    
                    // Allow scrolling
                    document.body.style.overflow = '';
                    
                    // Play video with audio
                    if (heroVideoPlayer) {
                        heroVideoPlayer.muted = false;
                        updateSoundIcon();
                        playHeroVideo();
                    }

                    // Remove overlay from DOM
                    setTimeout(() => {
                        enterOverlay.remove();
                        window.removeEventListener('resize', resizeBhCanvas);
                    }, 1500);
                    
                    return; // End animation loop
                }
            }

            animationId = requestAnimationFrame(animateBlackHole);
        }

        animateBlackHole();

        enterBtn.addEventListener('click', () => {
            // Hide the text and button immediately
            const enterContent = document.querySelector('.enter-content');
            if (enterContent) {
                enterContent.style.transition = 'opacity 0.5s ease';
                enterContent.style.opacity = '0';
            }
            
            // Trigger the black hole expansion
            isExpanding = true;
            
            // Remember that the user entered the site for this session
            sessionStorage.setItem('hasEnteredPortfolio', 'true');
        });
    }


    // ======================== INITIAL STATE ========================
    // Mark hero elements as visible immediately
    setTimeout(() => {
        document.querySelectorAll('.hero-section .animate-on-scroll').forEach(el => {
            const delay = parseInt(el.dataset.delay) || 0;
            setTimeout(() => el.classList.add('visible'), delay);
        });
    }, 300);

});
