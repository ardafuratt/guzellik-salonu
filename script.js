(function () {
  var stage = document.getElementById('stage');
  var video = document.getElementById('scrubVideo');
  var canvas = document.getElementById('scrubCanvas');
  var flood = document.getElementById('flood');
  var reveal = document.getElementById('reveal');
  var cap1 = document.getElementById('cap1');
  var cap2 = document.getElementById('cap2');
  var railFill = document.getElementById('railFill');
  var introOverlay = document.getElementById('introOverlay');

  var OVERLAY_HOLD = 0.09;
  var TOTAL_FRAMES = 121;
  var FRAME_WIDTH = 1280;
  var FRAME_HEIGHT = 700;

  var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reduceMq.matches;
  if (reduceMq.addEventListener) {
    reduceMq.addEventListener('change', function (e) { reduced = e.matches; });
  }

  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
    'ontouchstart' in window;

  var images = new Array(TOTAL_FRAMES);
  var loadedCount = 0;
  var targetProgress = 0;
  var smoothProgress = 0;
  var lastDrawnIndex = -1;
  var loopOn = false;

  var dest = { dx: 0, dy: 0, dw: 0, dh: 0 };
  var viewH = window.innerHeight;
  var stageH = 0;
  var origin = 0;

  var lastRail = -1;
  var lastOverlay = -1;
  var lastFlood = -1;
  var lastReveal = -1;

  function pad3(num) {
    if (num < 10) return '00' + num;
    if (num < 100) return '0' + num;
    return '' + num;
  }

  function frameUrl(index) {
    return 'assets/frames/' + pad3(index + 1) + '.webp';
  }

  function sizeCanvas() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    var scale = Math.max(canvas.width / FRAME_WIDTH, canvas.height / FRAME_HEIGHT);
    dest.dw = FRAME_WIDTH * scale;
    dest.dh = FRAME_HEIGHT * scale;
    dest.dx = (canvas.width - dest.dw) / 2;
    dest.dy = (canvas.height - dest.dh) / 2;

    lastDrawnIndex = -1;
    drawFrame(Math.round(smoothProgress * (TOTAL_FRAMES - 1)));
  }

  function measure() {
    viewH = window.innerHeight;
    stageH = stage.offsetHeight;
    origin = 0;
    var el = stage;
    while (el) {
      origin += el.offsetTop;
      el = el.offsetParent;
    }
    sizeCanvas();
  }

  function drawFrame(index) {
    index = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    if (index === lastDrawnIndex) return;

    // Find nearest loaded frame if current frame is still loading
    var img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (var offset = 1; offset < TOTAL_FRAMES; offset++) {
        var prev = images[index - offset];
        if (prev && prev.complete && prev.naturalWidth > 0) { img = prev; break; }
        var next = images[index + offset];
        if (next && next.complete && next.naturalWidth > 0) { img = next; break; }
      }
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, dest.dx, dest.dy, dest.dw, dest.dh);
      lastDrawnIndex = index;
    }
  }

  function preloadImages() {
    // Load frame 1 first for instant display
    var firstImg = new Image();
    firstImg.src = frameUrl(0);
    images[0] = firstImg;
    firstImg.onload = function () {
      loadedCount++;
      canvas.classList.add('is-on');
      if (video) video.classList.add('is-hidden');
      drawFrame(0);
    };

    // Load remaining frames
    for (var i = 1; i < TOTAL_FRAMES; i++) {
      (function (idx) {
        var img = new Image();
        img.src = frameUrl(idx);
        images[idx] = img;
        img.onload = function () {
          loadedCount++;
          if (idx === Math.round(smoothProgress * (TOTAL_FRAMES - 1))) {
            drawFrame(idx);
          }
        };
      })(i);
    }
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function remap(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function easeInQuad(t) { return t * t; }

  function setOpacityTransform(el, op, ty, lastRef) {
    var q = (op * 40 | 0);
    if (q === lastRef.v) return q;
    el.style.opacity = op;
    el.style.transform = 'translateY(' + ty + 'px)';
    return q;
  }

  function capStyle(el, t0, t1, p, lastRef) {
    var lp = remap(p, t0, t1);
    var fadeIn = remap(lp, 0, 0.2);
    var fadeOut = remap(lp, 0.75, 1);
    var op = Math.min(fadeIn, 1 - fadeOut);
    lastRef.v = setOpacityTransform(el, op, 18 * (1 - fadeIn), lastRef);
  }

  function computeProgress() {
    var total = stageH - viewH;
    var y = window.scrollY || window.pageYOffset || 0;
    return total > 0 ? clamp((y - origin) / total, 0, 1) : 0;
  }

  var cap1Cache = { v: -1 };
  var cap2Cache = { v: -1 };

  function render() {
    var p = computeProgress();
    var rail = (p * 1000 | 0);
    if (rail !== lastRail) {
      lastRail = rail;
      if (railFill) railFill.style.height = (p * 100) + '%';
    }

    var overlayT = 1 - remap(p, 0, OVERLAY_HOLD);
    var oq = (overlayT * 40 | 0);
    if (oq !== lastOverlay) {
      lastOverlay = oq;
      if (introOverlay) {
        introOverlay.style.opacity = overlayT;
        introOverlay.style.transform = 'translateY(' + ((1 - overlayT) * -14) + 'px)';
        introOverlay.style.visibility = overlayT < 0.02 ? 'hidden' : 'visible';
      }
    }

    var sceneP = remap(p, OVERLAY_HOLD, 1);
    var videoP = remap(sceneP, 0, 0.92);
    targetProgress = videoP;

    var follow = reduced ? 1 : (isTouch ? 0.92 : 0.85);
    smoothProgress += (targetProgress - smoothProgress) * follow;
    if (Math.abs(targetProgress - smoothProgress) < 0.001) {
      smoothProgress = targetProgress;
    }

    var frameIndex = Math.round(smoothProgress * (TOTAL_FRAMES - 1));
    drawFrame(frameIndex);

    var floodAmt = easeInQuad(remap(sceneP, 0.80, 0.97));
    var fq = (floodAmt * 40 | 0);
    if (fq !== lastFlood) {
      lastFlood = fq;
      if (flood) flood.style.opacity = floodAmt;
    }

    var revealT = remap(sceneP, 0.90, 1);
    var rq = (revealT * 40 | 0);
    if (rq !== lastReveal) {
      lastReveal = rq;
      if (reveal) {
        reveal.style.opacity = revealT;
        reveal.style.pointerEvents = revealT > 0.6 ? 'auto' : 'none';
      }
    }

    if (cap1) capStyle(cap1, 0.05, 0.42, sceneP, cap1Cache);
    if (cap2) capStyle(cap2, 0.45, 0.78, sceneP, cap2Cache);
  }

  function stageVisible() {
    var y = window.scrollY || window.pageYOffset || 0;
    return y < origin + stageH && y + viewH > origin - 8;
  }

  function loop() {
    render();
    if (loopOn) requestAnimationFrame(loop);
  }

  function setLoop(on) {
    if (on) {
      if (!loopOn) {
        loopOn = true;
        requestAnimationFrame(loop);
      }
    } else {
      loopOn = false;
    }
  }

  function syncLoop() {
    setLoop(stageVisible() && !document.hidden);
  }

  measure();
  setLoop(true);
  preloadImages();

  window.addEventListener('scroll', syncLoop, { passive: true });
  window.addEventListener('resize', function () {
    measure();
    syncLoop();
  });
  document.addEventListener('visibilitychange', syncLoop);

  var nav = document.getElementById('nav');
  var afterEl = document.querySelector('.after');
  var lastY = window.scrollY || 0;
  function updateNav() {
    if (!nav) return;
    var y = window.scrollY || window.pageYOffset || 0;
    var down = y > lastY + 6;
    var up = y < lastY - 6;
    if (y < 20) {
      nav.classList.remove('is-hidden', 'is-scrolled', 'is-lux');
    } else {
      nav.classList.add('is-scrolled');
      if (afterEl && afterEl.getBoundingClientRect().top < 72) nav.classList.add('is-lux');
      else nav.classList.remove('is-lux');
      if (down && y > 64) nav.classList.add('is-hidden');
      else if (up) nav.classList.remove('is-hidden');
    }
    lastY = y;
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
})();
