/* =========================================================================
   SUBURBIA SATÉLITE — interaction engine
   Vanilla JS · IntersectionObserver + rAF scroll. No external deps.
   ========================================================================= */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- */
  /*  PRELOADER                                                        */
  /* ---------------------------------------------------------------- */
  function preloader() {
    var pl = document.querySelector('.preloader');
    if (!pl) return finish();
    document.body.classList.add('is-locked');
    var count = pl.querySelector('.pl-count');
    var fill = pl.querySelector('.pl-line i');

    var n = 0;
    var dur = reduce ? 350 : 1700;
    var start = performance.now();
    var closed = false;
    function tick(t) {
      if (closed) return;
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      n = Math.round(eased * 100);
      if (count) count.textContent = String(n).padStart(3, '0');
      if (fill) fill.style.width = (eased * 100) + '%';
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(close, 320);
    }
    requestAnimationFrame(tick);

    // Hard fallback: rAF is throttled in background tabs and would otherwise
    // leave the page locked forever. setTimeout still fires — guarantee close.
    var hardClose = setTimeout(close, dur + 1400);

    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(hardClose);
      if (count) count.textContent = '100';
      if (fill) fill.style.width = '100%';
      pl.classList.add('done');
      document.body.classList.remove('is-locked');
      finish();
      setTimeout(function () { if (pl.parentNode) pl.parentNode.removeChild(pl); }, 1200);
    }
    function finish() {
      revealScan();
      kickHeroWords();
      revealFallback();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  REVEAL — IntersectionObserver                                    */
  /* ---------------------------------------------------------------- */
  var revealIO;
  function setupReveal() {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealScan();
  }
  function revealScan() {
    document.querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) {
      if (revealIO) revealIO.observe(el);
    });
    document.querySelectorAll('.reveal-words:not(.in)').forEach(function (el) {
      if (revealIO) revealIO.observe(el);
    });
  }

  // Safety net: force-reveal anything already on screen if IO is throttled.
  function revealFallback() {
    var vh = window.innerHeight;
    document.querySelectorAll('[data-reveal]:not(.in), .reveal-words:not(.in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
    });
  }

  // stagger delays from data-stagger containers
  function applyStagger() {
    document.querySelectorAll('[data-stagger]').forEach(function (c) {
      var step = parseInt(c.getAttribute('data-stagger'), 10) || 90;
      var kids = c.querySelectorAll('[data-reveal]');
      kids.forEach(function (k, i) { k.style.setProperty('--d', (i * step) + 'ms'); });
    });
  }

  /* split headlines into words for word reveal — preserves <em> accent */
  function splitWords() {
    document.querySelectorAll('[data-words]').forEach(function (el) {
      var nodes = [].slice.call(el.childNodes);
      el.textContent = '';
      el.classList.add('reveal-words');
      var i = 0;
      function addWord(word, accent) {
        var span = document.createElement('span');
        span.className = 'w';
        var inner = document.createElement('i');
        if (accent) inner.className = 'accent';
        inner.textContent = word;
        inner.style.setProperty('--wd', (i * 70) + 'ms');
        span.appendChild(inner);
        el.appendChild(span);
        el.appendChild(document.createTextNode(' '));
        i++;
      }
      nodes.forEach(function (node) {
        var accent = node.nodeType === 1 && node.tagName.toLowerCase() === 'em';
        var txt = (node.textContent || '').trim();
        if (!txt) return;
        txt.split(/\s+/).forEach(function (w) { addWord(w, accent); });
      });
    });
  }
  function kickHeroWords() {
    document.querySelectorAll('.cover [data-words]').forEach(function (el) {
      el.classList.add('in');
    });
  }

  /* ---------------------------------------------------------------- */
  /*  PARALLAX + scroll-driven chrome (single rAF loop)                */
  /* ---------------------------------------------------------------- */
  var parallaxEls = [];
  var ticking = false;
  function setupParallax() {
    parallaxEls = [].slice.call(document.querySelectorAll('[data-parallax]'));
    onScroll();
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var vh = window.innerHeight;
      var docH = document.documentElement.scrollHeight - vh;
      var sy = window.scrollY;

      // progress bar
      var bar = document.querySelector('.progress-bar');
      if (bar) bar.style.width = (docH > 0 ? (sy / docH) * 100 : 0) + '%';

      // parallax
      if (!reduce) {
        for (var i = 0; i < parallaxEls.length; i++) {
          var el = parallaxEls[i];
          var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
          var r = el.getBoundingClientRect();
          var mid = r.top + r.height / 2 - vh / 2;
          el.style.transform = 'translate3d(0,' + (-mid * speed).toFixed(2) + 'px,0)';
        }
      }

      // sticky sequence
      updateSequence(sy, vh);
      // reveal fallback (cheap, idempotent) — guards against throttled IO
      revealFallback();
      // scroll cue fade
      var cue = document.querySelector('.scrollcue');
      if (cue) cue.style.opacity = sy > vh * 0.5 ? '0' : '1';

      ticking = false;
    });
  }

  /* ---------------------------------------------------------------- */
  /*  CH02 — STICKY SCROLL SEQUENCE                                     */
  /* ---------------------------------------------------------------- */
  var seqData = null;
  function setupSequence() {
    var seq = document.querySelector('.seq');
    if (!seq) return;
    seqData = {
      root: seq,
      layers: [].slice.call(seq.querySelectorAll('.seq-layer')),
      items: [].slice.call(seq.querySelectorAll('.seq-stage-item')),
      caption: seq.querySelector('.seq-caption'),
      stepnum: seq.querySelector('.seq-step-num'),
      prog: seq.querySelector('.seq-progress i'),
      captions: [
        'Volumetric study — site envelope, orientation and program distribution across 5,200 m².',
        'Architectural intent — envelope, partitions, vertical circulation and finishes resolved to LOD 350.',
        'Structural skeleton — foundations, columns, beams and the mezzanine / roof slabs at +3.94 m and +7.87 m.',
        'MEP systems — hydraulics, fire protection, HVAC and electrical routed and coordinated in 3D.',
        'Federated model — all disciplines merged into a single coordinated digital twin.'
      ]
    };
  }
  function updateSequence(sy, vh) {
    if (!seqData) return;
    var s = seqData;
    var r = s.root.getBoundingClientRect();
    var total = s.root.offsetHeight - vh;
    var passed = -r.top;
    var p = Math.max(0, Math.min(1, passed / total));
    var n = s.layers.length;
    var idx = Math.min(n - 1, Math.floor(p * n));
    if (p >= 1) idx = n - 1;

    s.layers.forEach(function (l, i) { l.classList.toggle('active', i === idx); });
    s.items.forEach(function (it, i) {
      it.classList.toggle('on', i === idx);
      it.classList.toggle('done', i < idx);
    });
    if (s.stepnum) s.stepnum.textContent = 'STEP ' + String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    if (s.caption) s.caption.textContent = s.captions[idx] || '';
    if (s.prog) s.prog.style.width = (p * 100) + '%';
  }

  /* ---------------------------------------------------------------- */
  /*  CHAPTER NAV (active state)                                       */
  /* ---------------------------------------------------------------- */
  function setupChapterNav() {
    var buttons = [].slice.call(document.querySelectorAll('.chapternav button'));
    if (!buttons.length) return;
    var map = {};
    buttons.forEach(function (b) {
      var id = b.getAttribute('data-target');
      var sec = document.getElementById(id);
      if (sec) map[id] = { btn: b, sec: sec };
      b.addEventListener('click', function () {
        var t = document.getElementById(id);
        if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var id = e.target.id;
        if (e.isIntersecting && map[id]) {
          buttons.forEach(function (b) { b.classList.remove('active'); });
          map[id].btn.classList.add('active');
        }
      });
    }, { threshold: 0.0, rootMargin: '-45% 0px -45% 0px' });
    Object.keys(map).forEach(function (k) { navIO.observe(map[k].sec); });
  }

  /* ---------------------------------------------------------------- */
  /*  CH04 — BEFORE / AFTER COMPARISON                                 */
  /* ---------------------------------------------------------------- */
  function setupCompare() {
    document.querySelectorAll('.compare').forEach(function (cmp) {
      var after = cmp.querySelector('.cmp-after');
      var handle = cmp.querySelector('.cmp-handle');
      var dragging = false;
      function setPos(clientX) {
        var r = cmp.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        var pct = x * 100;
        if (after) after.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
        if (handle) handle.style.left = pct + '%';
      }
      function down(e) { dragging = true; setPos(pt(e)); e.preventDefault(); }
      function move(e) { if (dragging) setPos(pt(e)); }
      function up() { dragging = false; }
      function pt(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
      cmp.addEventListener('mousedown', down);
      cmp.addEventListener('touchstart', down, { passive: false });
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('mouseup', up);
      window.addEventListener('touchend', up);
      // reveal clash markers
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { cmp.classList.add('in'); io.unobserve(cmp); } });
      }, { threshold: 0.3 });
      io.observe(cmp);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  COUNTERS (animate numbers when visible)                          */
  /* ---------------------------------------------------------------- */
  function setupCounters() {
    function format(target, dec) {
      return target.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count'));
        var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        var dur = reduce ? 1 : 1500;
        var start = performance.now();
        var done = false;
        function tick(t) {
          var p = Math.min(1, (t - start) / dur);
          var v = (1 - Math.pow(1 - p, 3)) * target;
          el.textContent = format(v, dec);
          if (p < 1) requestAnimationFrame(tick);
          else { el.textContent = format(target, dec); done = true; }
        }
        requestAnimationFrame(tick);
        // Safety: rAF is throttled in background tabs — force final value.
        setTimeout(function () { if (!done) el.textContent = format(target, dec); }, dur + 1200);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
    // Hard fallback if the observer never fires at all.
    setTimeout(function () {
      document.querySelectorAll('[data-count]').forEach(function (el) {
        if (el.textContent.trim() === '0') {
          el.textContent = format(parseFloat(el.getAttribute('data-count')), parseInt(el.getAttribute('data-dec') || '0', 10));
        }
      });
    }, 6000);
  }

  /* ---------------------------------------------------------------- */
  /*  IN-VIEW class for charts / timeline (CSS-driven fills)           */
  /* ---------------------------------------------------------------- */
  function setupInView() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.tl-row, .chart-cell').forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------- */
  /*  HERO mouse parallax                                              */
  /* ---------------------------------------------------------------- */
  function setupMouseParallax() {
    if (reduce) return;
    var scopes = [].slice.call(document.querySelectorAll('[data-mouse]'));
    if (!scopes.length) return;
    window.addEventListener('mousemove', function (e) {
      var mx = (e.clientX / window.innerWidth - 0.5);
      var my = (e.clientY / window.innerHeight - 0.5);
      scopes.forEach(function (sc) {
        sc.querySelectorAll('[data-mouse-depth]').forEach(function (el) {
          var d = parseFloat(el.getAttribute('data-mouse-depth')) || 10;
          el.style.transform = 'translate3d(' + (-mx * d).toFixed(2) + 'px,' + (-my * d).toFixed(2) + 'px,0)';
        });
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /*  INIT                                                             */
  /* ---------------------------------------------------------------- */
  function init() {
    splitWords();
    applyStagger();
    setupReveal();
    setupParallax();
    setupSequence();
    setupChapterNav();
    setupCompare();
    setupCounters();
    setupInView();
    setupMouseParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    preloader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
