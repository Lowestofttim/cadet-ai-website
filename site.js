/* Cadet AI — marketing site behaviour. Progressive enhancement only:
   every animation has a no-JS / reduced-motion fallback that simply shows
   the final state. No third-party scripts, no trackers. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Animated stat counters ----------------------------------- */
  function counters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      nums.forEach(function (el) {
        el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var to = parseInt(el.getAttribute('data-count'), 10);
        var suf = el.getAttribute('data-suffix') || '';
        var dur = 1100, start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          el.textContent = Math.floor(p * to) + suf;
          if (p < 1) requestAnimationFrame(step); else el.textContent = to + suf;
        }
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---- 2. Scroll-reveal -------------------------------------------- */
  function reveals() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---- 3. Screenshot gallery: arrow controls + state --------------- */
  function gallery() {
    var track = document.querySelector('[data-gallery]');
    if (!track) return;
    var prev = document.querySelector('[data-gallery-prev]');
    var next = document.querySelector('[data-gallery-next]');
    if (!prev || !next) return;

    function page() {
      var card = track.querySelector('.shot');
      var step = card ? card.getBoundingClientRect().width + 26 : track.clientWidth * 0.8;
      return Math.max(step, 200);
    }
    function sync() {
      var max = track.scrollWidth - track.clientWidth - 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -page(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: page(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  /* ---- 4. Close the mobile nav after tapping a link ---------------- */
  function nav() {
    var toggle = document.getElementById('navtoggle');
    if (!toggle) return;
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { toggle.checked = false; });
    });
  }

  /* ---- 5. Scroll-progress bar + sticky-header state ---------------- */
  function scrollFx() {
    var bar = document.getElementById('scrollbar');
    var header = document.querySelector('.site-header');
    var doc = document.documentElement;
    function update() {
      var top = doc.scrollTop || document.body.scrollTop || 0;
      var max = doc.scrollHeight - doc.clientHeight;
      if (bar) bar.style.width = (max > 0 ? (top / max) * 100 : 0).toFixed(2) + '%';
      if (header) header.classList.toggle('scrolled', top > 12);
    }
    window.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---- 6. Hero device 3-D tilt (fine pointer only) ----------------- */
  function tilt() {
    if (reduce) return;
    var stage = document.querySelector('.hero-stage');
    var phone = stage && stage.querySelector('.phone');
    if (!phone || !(window.matchMedia && window.matchMedia('(pointer:fine)').matches)) return;
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      phone.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
      phone.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', function () {
      phone.style.setProperty('--rx', '0deg'); phone.style.setProperty('--ry', '0deg');
    });
  }

  /* ---- 7. Floating motes drifting up through the hero backdrop ----- */
  function motes() {
    if (reduce) return;
    var fx = document.querySelector('.hero-fx');
    if (!fx) return;
    for (var i = 0; i < 14; i++) {
      var m = document.createElement('span');
      m.className = 'mote';
      var s = (3 + Math.random() * 4).toFixed(1);
      m.style.left = (Math.random() * 100).toFixed(1) + '%';
      m.style.width = s + 'px'; m.style.height = s + 'px';
      m.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + 's';
      m.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';
      if (Math.random() > 0.6) m.style.background = 'var(--gold)';
      fx.appendChild(m);
    }
  }

  /* ---- 8. Voice-sample player + TANGO "speaking" reaction --------- */
  function voices() {
    var rail = document.querySelector('[data-voices]');
    if (!rail) return;
    var tango = document.querySelector('[data-tango]');
    var audio = new Audio();
    var current = null;
    function reset() {
      if (current) {
        current.classList.remove('playing');
        var p = current.querySelector('.play'); if (p) p.innerHTML = '&#9654;';
      }
      if (tango) tango.classList.remove('speaking');
      current = null;
    }
    function stop() { try { audio.pause(); } catch (e) {} reset(); }
    rail.querySelectorAll('.voice-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (current === card) { stop(); return; }
        stop();
        current = card;
        card.classList.add('playing');
        var p = card.querySelector('.play'); if (p) p.innerHTML = '&#10074;&#10074;';
        if (tango) tango.classList.add('speaking');
        audio.src = card.getAttribute('data-src');
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { stop(); });
      });
    });
    audio.addEventListener('ended', reset);
    audio.addEventListener('error', reset);
  }

  document.addEventListener('DOMContentLoaded', function () {
    counters();
    reveals();
    gallery();
    nav();
    scrollFx();
    tilt();
    motes();
    voices();
  });
})();
