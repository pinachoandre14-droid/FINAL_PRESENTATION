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

  function revealFallback() {
    var vh = window.innerHeight;
    document.querySelectorAll('[data-reveal]:not(.in), .reveal-words:not(.in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
    });
  }

  function applyStagger() {
    document.querySelectorAll('[data-stagger]').forEach(function (c) {
      var step = parseInt(c.getAttribute('data-stagger'), 10) || 90;
      var kids = c.querySelectorAll('[data-reveal]');
      kids.forEach(function (k, i) { k.style.setProperty('--d', (i * step) + 'ms'); });
    });
  }

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
  /*  PARALLAX + scroll chrome                                         */
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

      var bar = document.querySelector('.progress-bar');
      if (bar) bar.style.width = (docH > 0 ? (sy / docH) * 100 : 0) + '%';

      if (!reduce) {
        for (var i = 0; i < parallaxEls.length; i++) {
          var el = parallaxEls[i];
          var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
          var r = el.getBoundingClientRect();
          var mid = r.top + r.height / 2 - vh / 2;
          el.style.transform = 'translate3d(0,' + (-mid * speed).toFixed(2) + 'px,0)';
        }
      }

      updateSequence(sy, vh);
      updateHeroScrub(sy, vh);
      revealFallback();
      var cue = document.querySelector('.scrollcue');
      if (cue) cue.style.opacity = sy > vh * 0.5 ? '0' : '1';

      ticking = false;
    });
  }

  /* ---------------------------------------------------------------- */
  /*  CH01 — CANVAS SCROLL-SCRUB (Framer / Cloudflare pattern)        */
  /*  Video is decoded off-screen; each sought frame is drawn to       */
  /*  a fullscreen canvas — buttery smooth, no autoplay/loop.         */
  /* ---------------------------------------------------------------- */
  var _scrubVideo   = null;
  var _scrubSection = null;
  var _scrubCanvas  = null;
  var _scrubCtx     = null;
  var _scrubBar     = null;
  var _scrubOverlay = null;
  var _scrubReady   = false;
  var _scrubSeeking = false;
  var _scrubTarget  = 0;
  var _overlayShown = false;

  function setupHeroScrub() {
    _scrubVideo   = document.getElementById('hero-scrub-video');
    _scrubSection = document.getElementById('ch01');
    _scrubCanvas  = document.getElementById('hero-canvas');
    _scrubBar     = document.getElementById('hero-seq-bar');
    _scrubOverlay = document.getElementById('hero-seq-overlay');
    if (!_scrubVideo || !_scrubSection || !_scrubCanvas) return;

    _scrubCtx = _scrubCanvas.getContext('2d');

    /* ---- resize: retina-aware ---- */
    function resizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      _scrubCanvas.width  = Math.floor(window.innerWidth  * dpr);
      _scrubCanvas.height = Math.floor(window.innerHeight * dpr);
      _scrubCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _scrubCtx.imageSmoothingEnabled = true;
      _scrubCtx.imageSmoothingQuality = 'high';
      drawCurrentFrame();
    }

    /* ---- cover-fit draw ---- */
    function drawCurrentFrame() {
      if (!_scrubReady || !_scrubVideo.videoWidth) return;
      var vw = _scrubVideo.videoWidth,  vh2 = _scrubVideo.videoHeight;
      var cw = window.innerWidth,        ch  = window.innerHeight;
      var vRatio = vw / vh2, cRatio = cw / ch;
      var w, h, x, y;
      if (vRatio > cRatio) {           /* video wider → fill height, crop sides */
        h = ch; w = h * vRatio; x = (cw - w) / 2; y = 0;
      } else {                         /* video taller → fill width, crop top/bottom */
        w = cw; h = w / vRatio; x = 0; y = (ch - h) / 2;
      }
      _scrubCtx.clearRect(0, 0, cw, ch);
      _scrubCtx.drawImage(_scrubVideo, x, y, w, h);
    }

    /* ---- seek engine: queue next seek if target moved while seeking ---- */
    function seekTo(t) {
      if (_scrubSeeking) return;          /* let current seek finish */
      _scrubSeeking = true;
      _scrubVideo.currentTime = t;
    }

    _scrubVideo.addEventListener('seeked', function () {
      drawCurrentFrame();
      _scrubSeeking = false;
      /* drain: if target drifted during seek, chase it */
      if (Math.abs(_scrubTarget - _scrubVideo.currentTime) > 0.04) {
        seekTo(_scrubTarget);
      }
    });

    _scrubVideo.addEventListener('loadedmetadata', function () {
      _scrubReady = true;
      resizeCanvas();
      seekTo(0);
    });

    /* already cached */
    if (_scrubVideo.readyState >= 1) {
      _scrubReady = true;
      resizeCanvas();
      seekTo(0);
    }

    window.addEventListener('resize', resizeCanvas);
  }

  function updateHeroScrub(sy, vh) {
    if (!_scrubReady || !_scrubSection) return;

    var r        = _scrubSection.getBoundingClientRect();
    var scrollH  = _scrubSection.offsetHeight - vh;
    var progress = Math.max(0, Math.min(1, -r.top / scrollH));

    /* update progress bar */
    if (_scrubBar) _scrubBar.style.width = (progress * 100) + '%';

    /* seek video */
    var target = progress * _scrubVideo.duration;
    if (isFinite(target)) {
      _scrubTarget = target;
      seekTo(target);  /* seekTo is closure — call local version */
    }

    /* show overlay text when 75 % through */
    if (_scrubOverlay) {
      if (progress >= 0.75 && !_overlayShown) {
        _overlayShown = true;
        _scrubOverlay.classList.add('visible');
      } else if (progress < 0.72 && _overlayShown) {
        _overlayShown = false;
        _scrubOverlay.classList.remove('visible');
      }
    }
  }

  /* expose seekTo so updateHeroScrub can call it — re-declared as module var */
  function seekTo(t) {
    if (!_scrubVideo || _scrubSeeking) return;
    _scrubSeeking = true;
    _scrubVideo.currentTime = t;
  }

  /* ---------------------------------------------------------------- */
  /*  STICKY SCROLL SEQUENCE                                           */
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
  /*  CHAPTER NAV                                                      */
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
  /*  BEFORE / AFTER COMPARISON                                        */
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
      function down(e) {
        // Don't start drag if clicking an upload element
        if (e.target.closest('.ph')) return;
        dragging = true; setPos(pt(e)); e.preventDefault();
      }
      function move(e) { if (dragging) setPos(pt(e)); }
      function up() { dragging = false; }
      function pt(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
      cmp.addEventListener('mousedown', down);
      cmp.addEventListener('touchstart', down, { passive: false });
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('mouseup', up);
      window.addEventListener('touchend', up);
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { cmp.classList.add('in'); io.unobserve(cmp); } });
      }, { threshold: 0.3 });
      io.observe(cmp);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  COUNTERS                                                         */
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
        setTimeout(function () { if (!done) el.textContent = format(target, dec); }, dur + 1200);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      document.querySelectorAll('[data-count]').forEach(function (el) {
        if (el.textContent.trim() === '0') {
          el.textContent = format(parseFloat(el.getAttribute('data-count')), parseInt(el.getAttribute('data-dec') || '0', 10));
        }
      });
    }, 6000);
  }

  /* ---------------------------------------------------------------- */
  /*  IN-VIEW for charts / timeline                                    */
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
  /*  MOUSE PARALLAX                                                   */
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

  /* ================================================================ */
  /*  UPLOAD SYSTEM                                                    */
  /*  Click any .ph placeholder to upload an image or video.          */
  /*  Files are stored in localStorage as base64 and restored on load. */
  /* ================================================================ */
  var STORE_KEY = 'kubik_media_v1';

  /* Give every .ph a stable key derived from its label text */
  function phKey(el) {
    var label = el.querySelector('.pt');
    return label ? label.textContent.trim().replace(/\s+/g, '_').toLowerCase() : null;
  }

  /* Save a base64 dataURL to localStorage */
  function saveMedia(key, dataURL, mime) {
    try {
      var store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      store[key] = { url: dataURL, mime: mime };
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      // localStorage full — silent fail (media still shows in session)
      console.warn('KUBIK: localStorage full, media will not persist across refreshes.', e);
    }
  }

  /* Load all saved media from localStorage */
  function loadAllMedia() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch (e) { return {}; }
  }

  /* Remove a media entry */
  function clearMedia(key) {
    try {
      var store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      delete store[key];
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  /* Apply media (img or video) into a .ph element */
  function applyMedia(ph, dataURL, mime) {
    // Remove any previous media element
    var old = ph.querySelector('.ph-media');
    if (old) old.parentNode.removeChild(old);

    var isVideo = mime && mime.startsWith('video/');
    var media;

    if (isVideo) {
      media = document.createElement('video');
      media.autoplay = true;
      media.loop = true;
      media.muted = true;
      media.playsInline = true;
      media.src = dataURL;
    } else {
      media = document.createElement('img');
      media.src = dataURL;
      media.alt = '';
    }

    media.className = 'ph-media';
    ph.insertBefore(media, ph.firstChild);
    ph.classList.add('has-media');
  }

  /* Wire up a single .ph for uploading */
  function setupUploadZone(ph) {
    var key = phKey(ph);
    if (!key) return;

    // Inject hover hint UI
    var hint = document.createElement('div');
    hint.className = 'upload-hint';
    hint.innerHTML = '<div class="uh-icon"></div><span class="uh-text">Click to upload</span>';
    ph.appendChild(hint);

    // Inject remove button
    var removeBtn = document.createElement('button');
    removeBtn.className = 'upload-remove';
    removeBtn.title = 'Remove media';
    removeBtn.textContent = '✕';
    ph.appendChild(removeBtn);

    // Hidden file input
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/mp4,video/webm,video/ogg';
    input.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    ph.appendChild(input);

    // Click ph → open file picker (but not when clicking the remove button)
    ph.addEventListener('click', function (e) {
      if (e.target === removeBtn || removeBtn.contains(e.target)) return;
      input.click();
    });

    // File selected
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      ph.classList.add('uploading');
      var reader = new FileReader();
      reader.onload = function (ev) {
        var dataURL = ev.target.result;
        applyMedia(ph, dataURL, file.type);
        saveMedia(key, dataURL, file.type);
        ph.classList.remove('uploading');
      };
      reader.readAsDataURL(file);
      // Reset so same file can be re-picked
      input.value = '';
    });

    // Remove button
    removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var old = ph.querySelector('.ph-media');
      if (old) old.parentNode.removeChild(old);
      ph.classList.remove('has-media');
      clearMedia(key);
    });
  }

  /* Restore persisted media on page load */
  function restoreMedia() {
    var store = loadAllMedia();
    document.querySelectorAll('.ph').forEach(function (ph) {
      var key = phKey(ph);
      if (key && store[key]) {
        applyMedia(ph, store[key].url, store[key].mime);
      }
    });
  }

  /* Set up all upload zones */
  function setupUploads() {
    document.querySelectorAll('.ph').forEach(function (ph) {
      setupUploadZone(ph);
    });
    restoreMedia();
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
    setupUploads();
    setupHeroScrub();
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
