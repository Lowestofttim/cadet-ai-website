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
    var panels = document.querySelectorAll('[data-gallery-panel]');
    var track = document.querySelector('[data-gallery]');
    if (!track) return;
    var prev = document.querySelector('[data-gallery-prev]');
    var next = document.querySelector('[data-gallery-next]');
    if (!prev || !next) return;
    var tabs = document.querySelectorAll('[data-gallery-tab]');

    function activeTrack() {
      if (!panels.length) return track;
      for (var i = 0; i < panels.length; i++) {
        if (!panels[i].hidden) return panels[i];
      }
      return panels[0];
    }

    function page() {
      var current = activeTrack();
      var card = current.querySelector('.shot');
      var step = card ? card.getBoundingClientRect().width + 26 : current.clientWidth * 0.8;
      return Math.max(step, 200);
    }
    function sync() {
      var current = activeTrack();
      var max = current.scrollWidth - current.clientWidth - 4;
      prev.disabled = current.scrollLeft <= 4;
      next.disabled = current.scrollLeft >= max;
    }
    function setGallery(name) {
      panels.forEach(function (panel) {
        var active = panel.getAttribute('data-gallery-panel') === name;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
        if (active) panel.scrollLeft = 0;
      });
      tabs.forEach(function (tab) {
        var active = tab.getAttribute('data-gallery-tab') === name;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      sync();
    }
    prev.addEventListener('click', function () { activeTrack().scrollBy({ left: -page(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { activeTrack().scrollBy({ left: page(), behavior: reduce ? 'auto' : 'smooth' }); });
    if (panels.length) {
      panels.forEach(function (panel) {
        panel.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
      });
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () { setGallery(tab.getAttribute('data-gallery-tab')); });
      });
    } else {
      track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    }
    window.addEventListener('resize', sync);
    sync();
  }

  /* ---- 4. Close the mobile nav after tapping a link ---------------- */
  function nav() {
    var toggle = document.getElementById('navtoggle');
    if (!toggle) return;
    var navHistoryOpen = false;

    function replaceMenuHistory() {
      if (navHistoryOpen && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.href);
      }
      navHistoryOpen = false;
    }

    function openMenuHistory() {
      if (window.history && window.history.pushState && !navHistoryOpen) {
        window.history.pushState({ mobileNavOpen: true }, '', window.location.href);
        navHistoryOpen = true;
      }
    }

    function closeMenu(syncHistory) {
      var shouldSyncHistory = syncHistory !== false;
      toggle.checked = false;
      if (shouldSyncHistory && navHistoryOpen && window.history && window.history.back) {
        navHistoryOpen = false;
        window.history.back();
      } else {
        replaceMenuHistory();
      }
    }

    toggle.addEventListener('change', function () {
      if (toggle.checked) {
        openMenuHistory();
      } else if (navHistoryOpen) {
        closeMenu(true);
      }
    });

    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.checked) closeMenu(true);
    });

    window.addEventListener('popstate', function () {
      if (toggle.checked) {
        navHistoryOpen = false;
        toggle.checked = false;
      }
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
    var rails = document.querySelectorAll('[data-voices]');
    if (!rails.length) return;
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
    rails.forEach(function (rail) {
    rail.querySelectorAll('.voice-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (current === card) { stop(); return; }
        stop();
        current = card;
        card.classList.add('playing');
        var p = card.querySelector('.play'); if (p) p.innerHTML = '&#10074;&#10074;';
        if (tango) tango.classList.add('speaking');
        audio.src = card.getAttribute('data-src');
        var rate = parseFloat(card.getAttribute('data-rate') || '1');
        if (!Number.isFinite(rate) || rate <= 0) rate = 1;
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        if ('preservesPitch' in audio) audio.preservesPitch = true;
        if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { stop(); });
      });
    });
    });
    audio.addEventListener('ended', reset);
    audio.addEventListener('error', reset);
  }

  /* ---- 9. Interactive TANGO level viewer -------------------------- */
  function tangoViewer() {
    var modal = document.querySelector('[data-tango-viewer]');
    var openers = document.querySelectorAll('[data-tango-open]');
    if (!modal || !openers.length) return;

    var image = modal.querySelector('[data-tango-image]');
    var name = modal.querySelector('[data-tango-name]');
    var levelName = modal.querySelector('[data-tango-level-name]');
    var range = modal.querySelector('[data-tango-range]');
    var rail = modal.querySelector('[data-tango-levels]');
    var closeButtons = modal.querySelectorAll('[data-tango-close]');
    var prev = modal.querySelector('[data-tango-prev]');
    var next = modal.querySelector('[data-tango-next]');
    var close = modal.querySelector('.tango-modal-close');
    var video = modal.querySelector('[data-tango-video]');
    var videoWrap = modal.querySelector('[data-tango-video-wrap]');
    var playOverlay = modal.querySelector('[data-tango-play]');
    var levelsToggle = modal.querySelector('[data-tango-levels-toggle]');
    var levelsToggleLabel = modal.querySelector('[data-tango-levels-toggle-label]');
    var levelsPanel = modal.querySelector('[data-tango-levels-panel]');
    var dataPromise = null;
    var characters = {};
    var current = null;
    var levelIndex = 0;
    var lastFocus = null;
    var modalHistoryOpen = false;
    var levelsRendered = false;

    function requestJson(url) {
      if (window.fetch) {
        return fetch(url, { cache: 'force-cache' }).then(function (res) {
          if (!res.ok) throw new Error('Could not load TANGO showcase data');
          return res.json();
        });
      }
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (error) { reject(error); }
          } else {
            reject(new Error('Could not load TANGO showcase data'));
          }
        };
        xhr.onerror = function () { reject(new Error('Could not load TANGO showcase data')); };
        xhr.send();
      });
    }

    function loadData() {
      if (!dataPromise) {
        dataPromise = requestJson('assets/tango-roster/tango-showcase.json')
          .then(function (data) {
            (data.characters || []).forEach(function (character) {
              characters[character.id] = character;
            });
            return characters;
          });
      }
      return dataPromise;
    }

    function pushModalHistory() {
      if (window.history && window.history.pushState && !modalHistoryOpen) {
        window.history.pushState({ tangoViewerOpen: true }, '', window.location.href);
        modalHistoryOpen = true;
      }
    }

    function renderLevelRail() {
      if (!rail || !current) return;
      rail.textContent = '';
      current.levels.forEach(function (level, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(level.level);
        button.setAttribute('aria-label', current.name + ' ' + level.name);
        if (index === levelIndex) {
          button.className = 'is-active';
          button.setAttribute('aria-current', 'true');
        }
        button.addEventListener('click', function () {
          levelIndex = index;
          update();
        });
        rail.appendChild(button);
      });
    }

    function update() {
      if (!current || !current.levels[levelIndex]) return;
      var level = current.levels[levelIndex];
      if (image) {
        image.src = level.image;
        image.alt = current.name + ' TANGO ' + level.name;
      }
      if (name) name.textContent = current.name;
      if (levelName) levelName.textContent = level.name;
      if (range) range.value = String(level.level);
      if (prev) prev.disabled = levelIndex <= 0;
      if (next) next.disabled = levelIndex >= current.levels.length - 1;
      renderLevelRail();
    }

    function setVideo() {
      if (!video || !current) return;
      var src = current.video || '';
      var levels0 = current.levels && current.levels[0];
      video.pause();
      if (levels0 && levels0.image) video.poster = levels0.image;
      if (src) { video.src = src; } else { video.removeAttribute('src'); }
      video.load();
      video.controls = false;
      video.setAttribute('aria-label', current.name + ' TANGO intro film');
      if (videoWrap) videoWrap.classList.remove('is-playing');
    }

    function collapseLevels() {
      if (levelsPanel) levelsPanel.hidden = true;
      if (levelsToggle) levelsToggle.setAttribute('aria-expanded', 'false');
      if (levelsToggleLabel) levelsToggleLabel.textContent = 'Browse all 20 levels';
    }

    function expandLevels() {
      if (!levelsRendered) { update(); levelsRendered = true; }
      if (levelsPanel) levelsPanel.hidden = false;
      if (levelsToggle) levelsToggle.setAttribute('aria-expanded', 'true');
      if (levelsToggleLabel) levelsToggleLabel.textContent = 'Hide levels';
    }

    function toggleLevels() {
      if (levelsPanel && levelsPanel.hidden) expandLevels();
      else collapseLevels();
    }

    function openModal(id) {
      lastFocus = document.activeElement;
      loadData().then(function () {
        current = characters[id] || characters.tango_1;
        levelIndex = 0;
        levelsRendered = false;
        collapseLevels();
        setVideo();
        if (name) name.textContent = current.name;
        modal.hidden = false;
        document.body.classList.add('modal-open');
        pushModalHistory();
        if (close) close.focus();
      }).catch(function () {
        if (levelName) levelName.textContent = 'TANGO gallery is loading slowly. Please try again.';
        modal.hidden = false;
        document.body.classList.add('modal-open');
        pushModalHistory();
      });
    }

    function closeModal(syncHistory) {
      var shouldSyncHistory = syncHistory !== false;
      if (video) video.pause();
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      if (shouldSyncHistory && modalHistoryOpen && window.history && window.history.back) {
        modalHistoryOpen = false;
        window.history.back();
      } else {
        modalHistoryOpen = false;
      }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function move(delta) {
      if (!current) return;
      levelIndex = Math.max(0, Math.min(current.levels.length - 1, levelIndex + delta));
      update();
    }

    openers.forEach(function (button) {
      button.addEventListener('click', function () {
        openModal(button.getAttribute('data-tango-open'));
      });
    });
    closeButtons.forEach(function (button) { button.addEventListener('click', closeModal); });
    if (levelsToggle) levelsToggle.addEventListener('click', toggleLevels);
    if (playOverlay) playOverlay.addEventListener('click', function () {
      if (!video) return;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
    if (video) {
      video.addEventListener('play', function () { video.controls = true; if (videoWrap) videoWrap.classList.add('is-playing'); });
      video.addEventListener('playing', function () { video.controls = true; if (videoWrap) videoWrap.classList.add('is-playing'); });
      video.addEventListener('pause', function () { if (videoWrap) videoWrap.classList.remove('is-playing'); });
      video.addEventListener('ended', function () { if (videoWrap) videoWrap.classList.remove('is-playing'); });
    }
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    if (range) range.addEventListener('input', function () {
      levelIndex = Math.max(0, Math.min(19, parseInt(range.value, 10) - 1));
      update();
    });
    document.addEventListener('keydown', function (event) {
      if (modal.hidden) return;
      if (event.key === 'Escape') closeModal();
      if (levelsPanel && !levelsPanel.hidden) {
        if (event.key === 'ArrowLeft') move(-1);
        if (event.key === 'ArrowRight') move(1);
      }
    });
    window.addEventListener('popstate', function () {
      if (!modal.hidden) closeModal(false);
    });
  }

  /* ---- 10. Subject quiz preview cards ------------------------------ */
  function subjectPreview() {
    var preview = document.querySelector('[data-subject-preview]');
    var buttons = document.querySelectorAll('[data-subject]');
    if (!preview || !buttons.length) return;

    var content = {
      'drill': {
        kicker: 'Sample Drill & Turnout',
        title: 'Why do cadets practise drill?',
        copy: 'Drill teaches teamwork, discipline, bearing and confidence. Cadet AI turns that into short revision reps, clear explanations and follow-up questions.',
        question: 'When standing at attention, why should you brace rather than lock your knees?',
        answer: 'To stay steady and reduce the risk of feeling faint. TANGO keeps answers practical and reminds cadets to follow their instructors.'
      },
      'fieldcraft': {
        kicker: 'Sample Fieldcraft & Tactics',
        title: 'Train the habits before the exercise.',
        copy: 'Fieldcraft revision covers observation, movement, camouflage, field signals and safe teamwork, with explanations that avoid pretending one answer fits every local instruction.',
        question: 'What is fieldcraft really training you to do?',
        answer: 'Move, observe, communicate and work as a team while following the direction of qualified staff.'
      },
      'first-aid': {
        kicker: 'Sample First Aid',
        title: 'Clear first-aid recall, with safety first.',
        copy: 'First aid cards focus on priority actions, calm decision-making and knowing when to get adult or emergency help.',
        question: 'What should you check before helping a casualty?',
        answer: 'Check for danger first. Do not put yourself or others at risk, and get qualified help immediately when needed.'
      },
      'navigation': {
        kicker: 'Sample Navigation',
        title: 'Map skills that build confidence.',
        copy: 'Navigation practice breaks down symbols, grid references, contours, bearings and route planning into repeatable steps.',
        question: 'Why do cadets learn grid references?',
        answer: 'They let you describe a position clearly and quickly, so other people can understand exactly where you mean.'
      },
      'shooting': {
        kicker: 'Sample Shooting',
        title: 'Range safety before everything.',
        copy: 'Shooting revision stays safety-led and procedural, with reminders that range work belongs under qualified supervision.',
        question: 'What does safe range training depend on?',
        answer: 'Listening to commands, following instructor control, and never treating weapon handling as self-directed.'
      },
      'skill-at-arms': {
        kicker: 'Sample Skill at Arms',
        title: 'Procedure without guesswork.',
        copy: 'Skill at Arms topics vary by equipment and local instruction, so TANGO keeps cadets pointed back to current qualified teaching.',
        question: 'Why should TANGO avoid guessing on weapon procedures?',
        answer: 'Because small details matter. If a procedure depends on equipment or instruction, cadets must follow qualified staff.'
      },
      'military-knowledge': {
        kicker: 'Sample Military Knowledge',
        title: 'Know the structure you are part of.',
        copy: 'Military knowledge previews rank structure, traditions, responsibilities and cadet context without pretending to be official policy.',
        question: 'Why learn ranks and appointments?',
        answer: 'They help cadets understand responsibility, address people correctly and work confidently in a team.'
      },
      'communications': {
        kicker: 'Sample Communications & IT',
        title: 'Short, clear, correct.',
        copy: 'Comms practice focuses on clarity, procedure, message structure and safe digital habits.',
        question: 'What matters most in a radio-style message?',
        answer: 'Make it clear, concise and correctly structured so the receiver can act on it.'
      },
      'keeping-active': {
        kicker: 'Sample Keeping Active',
        title: 'Fitness that supports training.',
        copy: 'Keeping Active content links wellbeing, steady training habits and healthy progress without encouraging unsafe extremes.',
        question: 'What should good fitness training help cadets do?',
        answer: 'Build stamina, confidence and resilience while staying safe and listening to their body.'
      },
      'community': {
        kicker: 'Sample Community Engagement',
        title: 'Service, teamwork and reflection.',
        copy: 'Community topics show how volunteering, citizenship and teamwork fit the wider cadet experience.',
        question: 'What makes community work meaningful?',
        answer: 'It helps others, builds responsibility, and gives cadets a chance to reflect on how they contributed.'
      }
    };

    var kicker = preview.querySelector('[data-subject-kicker]');
    var title = preview.querySelector('[data-subject-title]');
    var copy = preview.querySelector('[data-subject-copy]');
    var question = preview.querySelector('[data-subject-question]');
    var answer = preview.querySelector('[data-subject-answer]');

    function show(key, shouldFocusPreview) {
      var item = content[key] || content.drill;
      if (kicker) kicker.textContent = item.kicker;
      if (title) title.textContent = item.title;
      if (copy) copy.textContent = item.copy;
      if (question) question.textContent = item.question;
      if (answer) answer.textContent = item.answer;
      buttons.forEach(function (button) {
        var active = button.getAttribute('data-subject') === key;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-pressed', 'true');
        else button.setAttribute('aria-pressed', 'false');
      });
      if (
        shouldFocusPreview &&
        window.matchMedia &&
        window.matchMedia('(max-width: 700px)').matches
      ) {
        window.setTimeout(function () {
          var top = preview.getBoundingClientRect().top + window.pageYOffset - 92;
          window.scrollTo({
            top: Math.max(0, top),
            behavior: reduce ? 'auto' : 'smooth',
          });
        }, 120);
      }
    }

    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
      button.addEventListener('click', function () { show(button.getAttribute('data-subject'), true); });
    });
  }

  function start() {
    counters();
    reveals();
    gallery();
    nav();
    scrollFx();
    tilt();
    motes();
    voices();
    tangoViewer();
    subjectPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
