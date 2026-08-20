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

  var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';

  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reduceMq.matches;
  if (reduceMq.addEventListener) {
    reduceMq.addEventListener('change', function (e) { reduced = e.matches; });
  }

  var duration = 0;
  var videoReady = false;
  var unlocked = false;
  var loopOn = false;

  var frames = [];
  var baked = false;
  var baking = false;
  var lastBakedTime = 0;
  var smoothTime = 0;
  var targetTime = 0;

  var coarse = window.matchMedia('(max-width:760px)').matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
    'ontouchstart' in window;
  var maxEdge = isTouch ? 560 : (coarse ? 640 : 960);
  var bakeW = maxEdge;
  var bakeH = Math.round(maxEdge * 9 / 16);
  var maxFrames = isTouch ? 84 : (coarse ? 120 : 180);
  var scrubMode = isTouch ? 'video' : 'canvas';
  var videoScrubReady = false;
  var lastScrubTime = -1;
  var needsGesture = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var dest = { dx: 0, dy: 0, dw: 0, dh: 0 };

  var viewH = window.innerHeight;
  var stageH = 0;
  var origin = 0;

  var lastRail = -1;
  var lastOverlay = -1;
  var lastFlood = -1;
  var lastReveal = -1;
  var lastDrawKey = '';

  function applyStageHeight() {
    var perSec = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--scroll-vh-per-second')
    );
    if (perSec > 0 && duration > 0) {
      stage.style.height = (duration * perSec) + 'vh';
    }
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

  function sizeCanvas() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var cap = isTouch ? 640 : (coarse ? 960 : 1280);
    var scale = w > cap ? cap / w : 1;
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    var s2 = Math.max(canvas.width / bakeW, canvas.height / bakeH);
    dest.dw = bakeW * s2;
    dest.dh = bakeH * s2;
    dest.dx = (canvas.width - dest.dw) / 2;
    dest.dy = (canvas.height - dest.dh) / 2;
    lastDrawKey = '';
  }

  function drawCover(img, alpha) {
    if (!img) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, dest.dx, dest.dy, dest.dw, dest.dh);
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  function captureSync(el) {
    var c = document.createElement('canvas');
    c.width = bakeW;
    c.height = bakeH;
    var cctx = c.getContext('2d', { alpha: false });
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'low';
    cctx.drawImage(el, 0, 0, bakeW, bakeH);
    return c;
  }

  function findSpan(t) {
    var n = frames.length;
    if (n === 1) return [0, 0, 0];
    if (t <= frames[0].t) return [0, 0, 0];
    if (t >= frames[n - 1].t) return [n - 1, n - 1, 0];
    var lo = 0;
    var hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (frames[mid].t <= t) lo = mid;
      else hi = mid;
    }
    var span = frames[hi].t - frames[lo].t;
    return [lo, hi, span > 0 ? (t - frames[lo].t) / span : 0];
  }

  function drawAtTime(t) {
    if (!frames.length) return;
    var span = findSpan(t);
    var a = frames[span[0]].img;
    var b = frames[span[1]].img;
    var frac = reduced ? 0 : span[2];
    var key = isTouch
      ? String(span[0]) + ':' + String(span[1])
      : span[0] + ':' + span[1] + ':' + (frac * 120 | 0);
    if (key === lastDrawKey) return;
    lastDrawKey = key;
    drawCover(a, 1);
    if (!isTouch && frac > 0.008 && a !== b) drawCover(b, frac);
  }

  function seekEl(el, t) {
    return new Promise(function (resolve) {
      if (Math.abs((el.currentTime || 0) - t) < 0.01) {
        resolve();
        return;
      }
      var done = function () {
        el.removeEventListener('seeked', done);
        resolve();
      };
      el.addEventListener('seeked', done);
      try { el.currentTime = t; } catch (e) { resolve(); }
    });
  }

  function bakeBySeek(el) {
    var count = isTouch ? 84 : (coarse ? 72 : 120);
    var i = 0;
    function next() {
      if (i >= count) {
        baked = true;
        baking = false;
        return Promise.resolve();
      }
      var t = (i / (count - 1)) * Math.max(0, duration - 0.04);
      return seekEl(el, t).then(function () {
        frames.push({ img: captureSync(el), t: t });
        lastBakedTime = t;
        i += 1;
        if (frames.length === 8) enableCanvas();
        if (isTouch && i % 3 === 0) {
          return new Promise(function (resolve) {
            requestAnimationFrame(resolve);
          }).then(next);
        }
        return next();
      });
    }
    el.pause();
    return next();
  }

  function bakeFromPlayback(el) {
    return new Promise(function (resolve, reject) {
      if (!el.requestVideoFrameCallback) {
        reject(new Error('no rVFC'));
        return;
      }
      var settled = false;
      var lastT = -1;
      var minGap = isTouch ? 1 / 45 : 1 / 60;

      function finish() {
        if (settled) return;
        settled = true;
        el.pause();
        if (frames.length < 8) {
          reject(new Error('few frames'));
          return;
        }
        baked = true;
        resolve();
      }

      function grab(now, meta) {
        var t = meta.mediaTime;
        if (t - lastT >= minGap || frames.length === 0) {
          lastT = t;
          frames.push({ img: captureSync(el), t: t });
          lastBakedTime = t;
          if (frames.length === 10) enableCanvas();
        }
        if (!settled && t < duration - 0.04 && frames.length < maxFrames) {
          el.requestVideoFrameCallback(grab);
        } else {
          finish();
        }
      }

      el.muted = true;
      el.defaultMuted = true;
      el.playbackRate = 1;
      var playP = el.play();
      if (playP && playP.then) {
        playP.then(function () { el.requestVideoFrameCallback(grab); }).catch(reject);
      } else {
        reject(new Error('play failed'));
      }
      setTimeout(function () {
        if (!settled && frames.length >= 8) finish();
        else if (!settled) reject(new Error('bake timeout'));
      }, Math.max(5000, duration * 1200));
    });
  }

  function enableCanvas() {
    if (scrubMode === 'video') return;
    canvas.classList.add('is-on');
    video.classList.add('is-hidden');
    lastDrawKey = '';
  }

  function enableVideoScrub() {
    scrubMode = 'video';
    videoScrubReady = true;
    video.classList.remove('is-hidden');
    canvas.classList.remove('is-on');
    video.removeAttribute('poster');
    lastScrubTime = -1;
  }

  function scrubVideo(t) {
    if (!videoReady || !videoScrubReady) return;
    if (Math.abs(lastScrubTime - t) < 0.02) return;
    lastScrubTime = t;
    if (typeof video.fastSeek === 'function') {
      try {
        video.fastSeek(t);
        return;
      } catch (e) {}
    }
    try {
      video.currentTime = t;
    } catch (e) {}
  }

  function startBake() {
    if (scrubMode === 'video' || reduced || baked || baking || !videoReady) return;
    baking = true;

    var baker = video.cloneNode(true);
    baker.removeAttribute('id');
    baker.muted = true;
    baker.defaultMuted = true;
    baker.playsInline = true;
    baker.setAttribute('playsinline', '');
    baker.setAttribute('muted', '');
    baker.preload = 'auto';
    baker.controls = false;
    baker.className = 'scrub-baker';
    baker.setAttribute('aria-hidden', 'true');
    baker.style.width = bakeW + 'px';
    baker.style.height = bakeH + 'px';
    document.body.appendChild(baker);

    function run() {
      var job = baker.requestVideoFrameCallback
        ? bakeFromPlayback(baker)
        : bakeBySeek(baker);

      job.then(function () {
        baking = false;
        enableCanvas();
        baker.remove();
      }).catch(function () {
        frames.length = 0;
        lastBakedTime = 0;
        bakeBySeek(baker).then(function () {
          enableCanvas();
          baker.remove();
        }).catch(function () {
          baking = false;
          baker.remove();
          enableVideoScrub();
        });
      });
    }

    if (baker.readyState >= 2) run();
    else baker.addEventListener('loadeddata', run, { once: true });
  }

  function unlockFirstFrame() {
    if (unlocked) return;
    unlocked = true;
    var p = video.play();
    if (p && p.then) {
      p.then(function () {
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
        if (isTouch) enableVideoScrub();
      }).catch(function () {
        try { video.currentTime = 0.001; } catch (e) {}
      });
    } else {
      try { video.currentTime = 0.001; } catch (e) {}
      if (isTouch) enableVideoScrub();
    }
  }

  function onVideoReady() {
    if (videoReady) return;
    duration = video.duration || 0;
    if (!(duration > 0) || !isFinite(duration)) return;
    videoReady = true;
    if (video.videoWidth && video.videoHeight) {
      var aspect = video.videoHeight / video.videoWidth;
      bakeW = maxEdge;
      bakeH = Math.max(1, Math.round(maxEdge * aspect));
    }
    applyStageHeight();
    measure();
    if (isTouch) {
      if (!needsGesture) {
        unlockFirstFrame();
      }
    } else {
      unlockFirstFrame();
      startBake();
    }
  }

  video.addEventListener('loadedmetadata', onVideoReady);
  video.addEventListener('loadeddata', onVideoReady);
  if (video.readyState >= 1) onVideoReady();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function remap(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function easeInQuad(t) { return t * t; }

  function setOpacityTransform(el, op, ty, cacheKey, lastRef) {
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
    lastRef.v = setOpacityTransform(el, op, 18 * (1 - fadeIn), 0, lastRef);
  }

  function computeProgress() {
    var total = stageH - viewH;
    var y = window.scrollY || window.pageYOffset || 0;
    return total > 0 ? clamp((y - origin) / total, 0, 1) : 0;
  }

  var cap1Cache = { v: -1 };
  var cap2Cache = { v: -1 };

  function frameFixed() {
    var p = computeProgress();
    var rail = (p * 1000 | 0);
    if (rail !== lastRail) {
      lastRail = rail;
      railFill.style.height = (p * 100) + '%';
    }

    var overlayT = 1 - remap(p, 0, OVERLAY_HOLD);
    var oq = (overlayT * 40 | 0);
    if (oq !== lastOverlay) {
      lastOverlay = oq;
      introOverlay.style.opacity = overlayT;
      introOverlay.style.transform = 'translateY(' + ((1 - overlayT) * -14) + 'px)';
      introOverlay.style.visibility = overlayT < 0.02 ? 'hidden' : 'visible';
    }

    var sceneP = remap(p, OVERLAY_HOLD, 1);
    var videoP = remap(sceneP, 0, 0.92);
    targetTime = duration > 0 ? videoP * Math.max(0, duration - 0.04) : 0;

    var follow = reduced ? 1 : (isTouch ? 0.9 : 0.82);
    smoothTime += (targetTime - smoothTime) * follow;
    if (Math.abs(targetTime - smoothTime) < 0.004) smoothTime = targetTime;

    if (scrubMode === 'video') {
      scrubVideo(smoothTime);
    } else if (frames.length) {
      var t = smoothTime > lastBakedTime ? lastBakedTime : smoothTime;
      drawAtTime(t);
    }

    var floodAmt = easeInQuad(remap(sceneP, 0.80, 0.97));
    var fq = (floodAmt * 40 | 0);
    if (fq !== lastFlood) {
      lastFlood = fq;
      flood.style.opacity = floodAmt;
    }

    var revealT = remap(sceneP, 0.90, 1);
    var rq = (revealT * 40 | 0);
    if (rq !== lastReveal) {
      lastReveal = rq;
      reveal.style.opacity = revealT;
      reveal.style.pointerEvents = revealT > 0.6 ? 'auto' : 'none';
    }

    capStyle(cap1, 0.05, 0.42, sceneP, cap1Cache);
    capStyle(cap2, 0.45, 0.78, sceneP, cap2Cache);
  }

  function stageVisible() {
    var y = window.scrollY || window.pageYOffset || 0;
    return y < origin + stageH && y + viewH > origin - 8;
  }

  function loop() {
    frameFixed();
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
  window.addEventListener('scroll', syncLoop, { passive: true });
  window.addEventListener('resize', function () {
    measure();
    syncLoop();
  });
  document.addEventListener('visibilitychange', syncLoop);
  if (isTouch) {
    function onTouchUnlock() {
      unlockFirstFrame();
      enableVideoScrub();
      measure();
      syncLoop();
      frameFixed();
    }
    document.addEventListener('touchstart', function touchHandler() {
      onTouchUnlock();
      document.removeEventListener('touchstart', touchHandler);
    }, { passive: true });
  }
  video.addEventListener('loadedmetadata', function () {
    measure();
    syncLoop();
  });
  setTimeout(function () {
    measure();
    syncLoop();
  }, 200);

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
