/* ============================================================
   ДАРСУ-ЛЬ-АРАБИЯ — главная страница
   Загружает список уроков и показывает прогресс
   ============================================================ */

(function () {
  'use strict';

  function pluralize(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function getProgressPct(lessonId) {
    try {
      var key = 'lesson-' + String(lessonId).padStart(2, '0') + '-progress';
      var saved = localStorage.getItem(key);
      if (!saved) return 0;
      var d = JSON.parse(saved);
      return Math.round(((d.theory || 0) + (d.vocab || 0) + (d.exercises || 0)) / 3);
    } catch (e) {
      return 0;
    }
  }

  function renderGrid(lessons) {
    var grid = document.getElementById('grid');
    grid.innerHTML = '';

    var totalPct = 0;
    var completed = 0;
    var availableCount = 0;

    lessons.forEach(function (L) {
      var pct = L.available ? getProgressPct(L.id) : 0;
      if (L.available) {
        availableCount++;
        totalPct += pct;
        if (pct >= 95) completed++;
      }

      var card = document.createElement(L.available ? 'a' : 'div');
      card.className = 'lesson-card glass';
      if (!L.available) card.classList.add('locked');
      if (pct >= 95) card.classList.add('complete');
      if (L.available) card.href = 'lesson.html?id=' + L.id;

      card.innerHTML =
        '<div>' +
          '<div class="lesson-num">Урок ' + L.id + '</div>' +
          '<div class="lesson-title">' + L.title_ru + '</div>' +
          '<div class="lesson-ar">' + L.title_ar + '</div>' +
        '</div>' +
        '<div class="lesson-status">' +
          '<div class="lesson-progress">' +
            '<div class="lesson-progress-fill" style="width: ' + pct + '%"></div>' +
          '</div>' +
          '<div class="lesson-pct">' + (L.available ? pct + '%' : '—') + '</div>' +
        '</div>';

      grid.appendChild(card);
    });

    var overall = availableCount ? Math.round(totalPct / availableCount) : 0;
    var circ = 2 * Math.PI * 26;
    document.getElementById('totalRing').setAttribute('stroke-dashoffset', circ * (1 - overall / 100));
    document.getElementById('totalPct').textContent = overall + '%';
    document.getElementById('totalText').textContent =
      completed + ' из ' + availableCount + ' ' +
      pluralize(availableCount, 'урока пройдено', 'уроков пройдено', 'уроков пройдено');
  }

  function showError(msg) {
    document.getElementById('grid').innerHTML =
      '<p style="color: var(--ink-muted); padding: 20px; text-align: center;">' + msg + '</p>';
    document.getElementById('totalText').textContent = '—';
  }

  function loadLessons() {
    fetch('data/lessons.json?v=' + Date.now())
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (lessons) {
        renderGrid(lessons);
      })
      .catch(function (e) {
        console.error('Не удалось загрузить список уроков:', e);
        showError('Не удалось загрузить список уроков. Обновите страницу.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLessons);
  } else {
    loadLessons();
  }
})();
