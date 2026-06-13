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

  document.addEventListener('DOMContentLoaded', function () {
    counters();
    reveals();
    gallery();
    nav();
  });
})();
