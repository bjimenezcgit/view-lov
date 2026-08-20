(() => {
  'use strict';

  const MIN_PLAY_SECONDS = 90;
  const TARGET_VOLUME = 0.18;
  const FADE_IN_MS = 4000;
  const FADE_OUT_MS = 3000;

  const loader = document.getElementById('loader');
  const audio = document.getElementById('ambient-audio');
  const audioToggle = document.getElementById('audio-toggle');
  const progressBar = document.querySelector('.audio-progress__bar');
  const progressWrap = document.getElementById('audio-progress');
  const reveals = document.querySelectorAll('.reveal');
  const navDots = document.querySelectorAll('.side-nav__dot');
  const sections = document.querySelectorAll('.section');

  let audioStarted = false;
  let fadeInterval = null;
  let playStartTime = null;
  let isScrolling = false;
  let scrollTimer = null;

  /* ─── Scroll: aliviar carga durante desplazamiento ─── */
  function initScrollPerf() {
    const onScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        document.body.classList.add('is-scrolling');
      }

      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        isScrolling = false;
        document.body.classList.remove('is-scrolling');
      }, 120);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ─── Navegación suave solo al hacer clic ─── */
  function initSmoothNav() {
    navDots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(dot.getAttribute('href'));
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ─── Partículas optimizadas ─── */
  function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let particles = [];
    let animId = null;
    let lastTime = 0;
    let width = 0;
    let height = 0;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }

    function createParticles() {
      const count = Math.min(45, Math.floor(width / 28));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.35,
        speed: Math.random() * 0.12 + 0.04,
        angle: Math.random() * Math.PI * 2,
        drift: Math.random() * 0.002 + 0.001,
        alpha: Math.random() * 0.28 + 0.06,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function draw(time) {
      const delta = Math.min((time - lastTime) / 16.67, 2);
      lastTime = time;

      if (!isScrolling && !document.hidden) {
        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
          p.angle += p.drift * delta;
          p.x += Math.cos(p.angle) * p.speed * delta;
          p.y += Math.sin(p.angle) * p.speed * delta;

          const pulse = 0.85 + Math.sin(time * 0.001 + p.phase) * 0.15;

          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 165, 154, ${p.alpha * pulse})`;
          ctx.fill();
        });
      }

      animId = requestAnimationFrame(draw);
    }

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        createParticles();
      }, 200);
    };

    resize();
    createParticles();
    animId = requestAnimationFrame(draw);
    window.addEventListener('resize', onResize, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) lastTime = performance.now();
    });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }

  /* ─── Fade de volumen ─── */
  function fadeVolume(from, to, durationMs, onComplete) {
    if (fadeInterval) clearInterval(fadeInterval);

    const steps = 40;
    const stepMs = durationMs / steps;
    const delta = (to - from) / steps;
    let current = from;
    let step = 0;

    fadeInterval = setInterval(() => {
      step++;
      current += delta;
      audio.volume = Math.max(0, Math.min(1, current));

      if (step >= steps) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        audio.volume = to;
        if (onComplete) onComplete();
      }
    }, stepMs);
  }

  function updateProgress() {
    if (!audioStarted || !playStartTime) return;

    const elapsed = (Date.now() - playStartTime) / 1000;
    const pct = Math.min((elapsed / MIN_PLAY_SECONDS) * 100, 100);
    progressBar.style.width = `${pct}%`;
  }

  function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    playStartTime = Date.now();

    audio.volume = 0;
    audio.currentTime = 0;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          fadeVolume(0, TARGET_VOLUME, FADE_IN_MS);
          audioToggle.classList.add('is-playing');
          audioToggle.setAttribute('aria-label', 'Silenciar música ambiental');
          progressWrap.classList.add('is-visible');
          progressWrap.setAttribute('aria-hidden', 'false');

          const progressTimer = setInterval(updateProgress, 200);

          setTimeout(() => {
            clearInterval(progressTimer);
            fadeVolume(audio.volume, 0, FADE_OUT_MS, () => {
              audio.pause();
              audioToggle.classList.remove('is-playing');
            });
          }, MIN_PLAY_SECONDS * 1000);
        })
        .catch(() => {
          audioStarted = false;
          showAudioToggle(true);
        });
    }
  }

  function toggleAudio() {
    if (audio.paused) {
      audioStarted = false;
      startAudio();
    } else {
      fadeVolume(audio.volume, 0, 800, () => audio.pause());
      audioToggle.classList.remove('is-playing');
    }
  }

  function showAudioToggle(fallback = false) {
    audioToggle.hidden = false;
    requestAnimationFrame(() => {
      audioToggle.classList.add('is-visible');
    });
    if (fallback) {
      audioToggle.querySelector('.audio-toggle__label').textContent = 'Escuchar';
    }
  }

  /* ─── Observer unificado: reveal + nav ─── */
  function initScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          if (entry.target.classList.contains('reveal')) {
            entry.target.classList.add('is-visible');
          }

          if (entry.target.classList.contains('section')) {
            const id = entry.target.dataset.section;
            navDots.forEach((dot) => {
              dot.classList.toggle('is-active', dot.dataset.section === id);
            });
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -5% 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
    sections.forEach((section) => observer.observe(section));
  }

  /* ─── Carga completa ─── */
  function onEverythingLoaded() {
    setTimeout(() => {
      loader.classList.add('is-hidden');

      setTimeout(() => {
        startAudio();
        showAudioToggle(false);
      }, 600);
    }, 800);
  }

  /* ─── Init ─── */
  function init() {
    initScrollPerf();
    initSmoothNav();
    initParticles();
    initScrollObserver();

    audioToggle.addEventListener('click', toggleAudio);

    document.fonts.ready.then(() => {
      if (document.readyState === 'complete') {
        onEverythingLoaded();
      } else {
        window.addEventListener('load', onEverythingLoaded);
      }
    });

    document.addEventListener(
      'click',
      () => {
        if (!audioStarted) startAudio();
      },
      { once: true }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
