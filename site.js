// Progressive enhancement only: animate stat numbers on scroll.
// Each [data-count] element already contains its final value as text, so with
// JS disabled the correct number still shows.
document.addEventListener('DOMContentLoaded', function () {
  var nums = document.querySelectorAll('[data-count]');
  if (!('IntersectionObserver' in window) || !nums.length) return;
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
});
