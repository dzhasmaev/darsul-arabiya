/* ============================================================
   ДАРСУ-ЛЬ-АРАБИЯ — страница урока
   Загружает JSON урока и собирает страницу
   ============================================================ */

(function () {
  'use strict';

  // ---------- Состояние ----------
  var STATE = {
    lesson: null,
    lessonId: null,
    flipped: new Set(),
    tfAnswered: new Map(),
    fillAnswered: new Map(),
    matchAnswered: new Map(),
    numAnswered: new Map(),
    selectedMatchLeft: null,
    scrollProgress: 0
  };

  var params = new URLSearchParams(window.location.search);
  STATE.lessonId = params.get('id') || '1';
  var lessonFile = 'data/lesson-' + String(STATE.lessonId).padStart(2, '0') + '.json';

  // ---------- Утилиты ----------
  var TASHKEEL_REGEX = /[\u064B-\u0652\u0670]/g;
  function stripTashkeel(text) { return text.replace(TASHKEEL_REGEX, ''); }
  function normalizeArabic(s) {
    return s.replace(TASHKEEL_REGEX, '').replace(/\s+/g, ' ').replace(/[.،؟!]/g, '').trim();
  }
  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function pluralize(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg || 'Сохранено';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1200);
  }

  // ---------- Загрузка урока ----------
  function loadLesson() {
    fetch(lessonFile + '?v=' + Date.now())
      .then(function (resp) {
        if (!resp.ok) throw new Error('Урок не найден (HTTP ' + resp.status + ')');
        return resp.json();
      })
      .then(function (data) {
        STATE.lesson = data;
        document.title = 'Урок ' + STATE.lessonId + ' — ' + data.title_ru;
        document.getElementById('navLessonNum').textContent = 'Урок ' + STATE.lessonId;
        renderLesson();
      })
      .catch(function (e) {
        document.getElementById('content').innerHTML =
          '<div class="loading error">Не удалось загрузить урок ' + STATE.lessonId + '.<br>' + e.message + '</div>';
      });
  }

  // ---------- Рендер всей страницы ----------
  function renderLesson() {
    var L = STATE.lesson;
    var html =
      '<header class="hero">' +
        '<div class="hero-eyebrow">Урок ' + STATE.lessonId + '</div>' +
        '<h1>' + L.title_ru + '</h1>' +
        '<div class="hero-ar">' + L.title_ar + '</div>' +
        (L.lead ? '<p class="hero-lead">' + L.lead + '</p>' : '') +
      '</header>' +

      '<div class="segments-wrap glass-strong">' +
        '<div class="segments">' +
          '<button class="segment active" data-tab="theory" type="button">Теория</button>' +
          '<button class="segment" data-tab="vocab" type="button">Словарь</button>' +
          '<button class="segment" data-tab="exercises" type="button">Упражнения</button>' +
          '<button class="segment" data-tab="progress" type="button">Прогресс</button>' +
        '</div>' +
      '</div>' +

      '<main class="container">' +
        '<section class="section active" id="theory">' + renderTheory() + '</section>' +
        '<section class="section" id="vocab">' + renderVocabSection() + '</section>' +
        '<section class="section" id="exercises">' + renderExercisesSection() + '</section>' +
        '<section class="section" id="progress">' + renderProgressSection() + '</section>' +
      '</main>';

    document.getElementById('content').innerHTML = html;

    attachSegments();
    attachDialogue();
    attachVocab();
    attachExercises();
    attachTashkeelToggle();
    loadProgress();
    updateRings();
  }

  // ---------- ТЕОРИЯ ----------
  function renderTheory() {
    var L = STATE.lesson;
    var html = '';

    if (L.dialogue && L.dialogue.length) {
      html +=
        '<div class="section-eyebrow">Диалог</div>' +
        '<h2 class="section-title-lesson">' + (L.dialogue_title || 'Диалог.') + '</h2>' +
        '<p class="section-sub">' + (L.dialogue_sub || (L.dialogue.length + ' реплик. Тапните по строке, чтобы увидеть перевод.')) + '</p>' +
        '<div class="dialogue glass">' +
          L.dialogue.map(function (line) {
            return '<div class="dialogue-line speaker-' + (line.speaker_class || 'a') + '" data-tr="' + escapeAttr(line.tr) + '">' +
              '<div class="speaker-label">' + line.speaker_name + '</div>' +
              '<div class="line-ar">' + line.ar + '</div>' +
              '<div class="line-tr"></div>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    if (L.grammar && L.grammar.length) {
      html += '<h2 class="section-title-lesson">Грамматика урока</h2>';
      if (L.grammar_sub) html += '<p class="section-sub">' + L.grammar_sub + '</p>';
      L.grammar.forEach(function (g, i) {
        html += '<div class="grammar glass">' +
          '<div class="grammar-num">Грамматика · ' + (i + 1) + '</div>' +
          '<h3>' + g.title_ru + '</h3>' +
          '<div class="grammar-ar">' + g.title_ar + '</div>' +
          renderGrammarBlocks(g.blocks) +
        '</div>';
      });
    }

    return html;
  }

  function renderGrammarBlocks(blocks) {
    if (!blocks) return '';
    return blocks.map(function (b) {
      if (typeof b === 'string') return '<p>' + b + '</p>';
      if (b.type === 'p') return '<p>' + b.text + '</p>';
      if (b.type === 'example') {
        return '<div class="example">' +
          '<div class="example-ar">' + b.ar + '</div>' +
          (b.tr ? '<div class="example-tr">' + b.tr + '</div>' : '') +
        '</div>';
      }
      if (b.type === 'parse') {
        var parseHtml = '<div class="parse">';
        b.rows.forEach(function (row, idx) {
          if (idx > 0) parseHtml += '<div class="parse-divider"></div>';
          parseHtml += '<div class="parse-pair">';
          row.words.forEach(function (w) {
            parseHtml += '<div class="parse-cell">' +
              '<div class="parse-word ' + (w.accent ? 'accent' : '') + '">' + w.ar + '</div>' +
              '<div class="parse-tag">' + w.tag + '</div>' +
            '</div>';
          });
          parseHtml += '</div>';
        });
        parseHtml += '</div>';
        return parseHtml;
      }
      if (b.type === 'table') {
        var tableHtml = '<div class="ar-table">';
        b.rows.forEach(function (row) {
          if (Array.isArray(row)) {
            tableHtml += '<div class="ar-row">' + row[0] + ' <span class="op">+</span> ' + row[1] + ' <span class="op">=</span> <span class="res">' + row[2] + '</span></div>';
          } else {
            tableHtml += '<div class="ar-row">' + row + '</div>';
          }
        });
        tableHtml += '</div>';
        return tableHtml;
      }
      if (b.type === 'forms') {
        var cols = b.cols || (b.cells.length <= 2 ? 2 : b.cells.length <= 4 ? 4 : 5);
        var formsHtml = '<div class="forms-grid cols-' + cols + '">';
        b.cells.forEach(function (c) {
          formsHtml += '<div class="form-cell">' +
            '<div class="ar-form">' + c.ar + '</div>' +
            '<div class="lbl">' + (c.lbl || '') + '</div>' +
          '</div>';
        });
        formsHtml += '</div>';
        return formsHtml;
      }
      return '';
    }).join('');
  }

  // ---------- СЛОВАРЬ ----------
  function renderVocabSection() {
    var L = STATE.lesson;
    if (!L.vocab || !L.vocab.length) return '<p>Словарь не задан.</p>';
    return '<div class="section-eyebrow">Словарь</div>' +
      '<h2 class="section-title-lesson">' + L.vocab.length + ' новых слов.</h2>' +
      '<p class="section-sub">Тапните по карточке, чтобы увидеть перевод. Когда откроете все — кольцо словаря замкнётся.</p>' +
      '<div class="vocab-grid" id="vocabGrid">' +
        L.vocab.map(function (w, i) {
          return '<div class="vocab-card glass" data-vocab-i="' + i + '">' +
            '<div class="vocab-mark">✓</div>' +
            '<div class="vocab-ar">' + w.ar + '</div>' +
            (w.plural ? '<div class="vocab-plural">' + w.plural + '</div>' : '') +
            '<div class="vocab-tr">' + w.tr + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
  }

  // ---------- УПРАЖНЕНИЯ ----------
  function renderExercisesSection() {
    var L = STATE.lesson;
    if (!L.exercises || !L.exercises.length) return '<p>Упражнения пока не подключены.</p>';

    var totalEx = L.exercises_total || L.exercises.length;
    var interactive = L.exercises.filter(function (e) { return e.type !== 'placeholder'; }).length;
    var html =
      '<div class="section-eyebrow">Упражнения</div>' +
      '<h2 class="section-title-lesson">' + totalEx + ' ' + pluralize(totalEx, 'задание', 'задания', 'заданий') + '.</h2>' +
      '<p class="section-sub">Здесь работают ' + interactive + ' ' + pluralize(interactive, 'интерактивное', 'интерактивных', 'интерактивных') + '. Остальные показаны списком.</p>';

    L.exercises.forEach(function (ex) {
      if (ex.type === 'placeholder') return;
      html += renderExercise(ex);
    });

    var placeholders = L.exercises.filter(function (e) { return e.type === 'placeholder'; });
    if (placeholders.length) {
      html += '<div class="more-list glass">' +
        '<h3>Остальные задания</h3>' +
        '<p>В полной версии все ' + totalEx + ' будут интерактивными.</p>' +
        '<ul>' +
          placeholders.map(function (p) {
            return '<li><span class="num">№&nbsp;' + p.num + '</span>' + p.title + '</li>';
          }).join('') +
        '</ul>' +
      '</div>';
    }
    return html;
  }

  function renderExercise(ex) {
    var inner = '';
    if (ex.type === 'true_false') inner = renderTF(ex);
    else if (ex.type === 'fill_inna' || ex.type === 'fill_input' || ex.type === 'questions') inner = renderFillInput(ex);
    else if (ex.type === 'matching') inner = renderMatching(ex);
    else if (ex.type === 'number_words') inner = renderNumWords(ex);

    return '<div class="exercise glass" data-ex-num="' + ex.num + '">' +
      '<div class="exercise-num">№&nbsp;' + ex.num + '</div>' +
      '<div class="exercise-title">' + ex.title + '</div>' +
      (ex.instruction_ar ? '<div class="exercise-instr">' + ex.instruction_ar + '</div>' : '') +
      (ex.instruction_ru ? '<div class="exercise-instr-ru">' + ex.instruction_ru + '</div>' : '') +
      inner +
    '</div>';
  }

  function renderTF(ex) {
    return ex.items.map(function (item, i) {
      return '<div class="tf-item">' +
        '<div class="tf-text">' + item.ar + '</div>' +
        '<div class="tf-buttons">' +
          '<button class="tf-btn" data-val="true" data-ex="' + ex.num + '" data-i="' + i + '" type="button">✓</button>' +
          '<button class="tf-btn" data-val="false" data-ex="' + ex.num + '" data-i="' + i + '" type="button">✗</button>' +
        '</div>' +
        '<div class="feedback" id="tf-fb-' + ex.num + '-' + i + '"></div>' +
      '</div>';
    }).join('');
  }

  function renderFillInput(ex) {
    return ex.items.map(function (item, i) {
      return '<div class="ex-item">' +
        '<div class="ex-num">' + (i + 1) + '</div>' +
        '<div class="ex-prompt">' + item.prompt + '</div>' +
        '<input type="text" class="ex-input" data-ex="' + ex.num + '" data-i="' + i + '" placeholder="' + (ex.placeholder || 'Перепишите…') + '" autocomplete="off" autocorrect="off" />' +
        '<div class="feedback" id="fill-fb-' + ex.num + '-' + i + '"></div>' +
      '</div>';
    }).join('');
  }

  function renderMatching(ex) {
    var rightItems = ex.pairs.map(function (p, idx) { return Object.assign({}, p, { idx: idx }); });
    for (var i = rightItems.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = rightItems[i]; rightItems[i] = rightItems[j]; rightItems[j] = tmp;
    }
    return '<div class="match-cols">' +
      '<div>' +
        '<div class="match-col-title">' + (ex.left_title || 'Слева') + '</div>' +
        '<div class="match-stack">' +
          ex.pairs.map(function (p, i) {
            return '<div class="match-chip" data-ex="' + ex.num + '" data-idx="' + i + '" data-side="left">' + p.left + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="match-col-title">' + (ex.right_title || 'Справа') + '</div>' +
        '<div class="match-stack">' +
          rightItems.map(function (p) {
            return '<div class="match-chip" data-ex="' + ex.num + '" data-idx="' + p.idx + '" data-side="right">' + p.right + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderNumWords(ex) {
    return ex.items.map(function (item, i) {
      var promptHtml = item.target ? item.prompt.replace(item.target, '<span class="target">' + item.target + '</span>') : item.prompt;
      return '<div class="ex-item">' +
        '<div class="ex-num">' + (i + 1) + '</div>' +
        '<div class="ex-prompt num-prompt">' + promptHtml + '</div>' +
        '<input type="text" class="ex-input num-input" data-ex="' + ex.num + '" data-i="' + i + '" placeholder="' + (ex.placeholder || 'прописью…') + '" autocomplete="off" autocorrect="off" />' +
        '<div class="feedback" id="fill-fb-' + ex.num + '-' + i + '"></div>' +
      '</div>';
    }).join('');
  }

  // ---------- ПРОГРЕСС ----------
  function renderProgressSection() {
    var L = STATE.lesson;
    return '<div class="section-eyebrow">Прогресс</div>' +
      '<h2 class="section-title-lesson">Ваш путь по уроку.</h2>' +
      '<p class="section-sub">Обновляется автоматически. Сохраняется в браузере.</p>' +
      '<div class="rings">' +
        renderRing('ringTheory', 'Теория', 'Откройте диалог') +
        renderRing('ringVocab', 'Словарь', '0 из ' + (L.vocab ? L.vocab.length : 0)) +
        renderRing('ringEx', 'Упражнения', '0 из ' + countInteractive()) +
      '</div>' +
      '<div class="quote-card glass">' +
        '<div class="quote-ar">' + (L.quote_ar || 'إنَّ مَعَ العُسْرِ يُسْرًا') + '</div>' +
        '<div class="quote-ru">' + (L.quote_ru || 'Поистине, вместе с тягостью — облегчение') + '</div>' +
      '</div>' +
      '<div class="lesson-nav">' + renderLessonNav() + '</div>';
  }

  function renderRing(id, name, detail) {
    return '<div class="ring-card glass">' +
      '<svg class="ring-svg" viewBox="0 0 96 96">' +
        '<circle class="ring-bg-c" cx="48" cy="48" r="40" fill="none" stroke-width="7"/>' +
        '<circle class="ring-fg-c" id="' + id + '" cx="48" cy="48" r="40" fill="none" stroke-width="7" ' +
          'stroke-dasharray="251" stroke-dashoffset="251" transform="rotate(-90 48 48)"/>' +
        '<text class="ring-pct" id="' + id + 'Pct" x="48" y="55" text-anchor="middle">0%</text>' +
      '</svg>' +
      '<div class="ring-name">' + name + '</div>' +
      '<div class="ring-detail" id="' + id + 'Detail">' + detail + '</div>' +
    '</div>';
  }

  function renderLessonNav() {
    var cur = parseInt(STATE.lessonId, 10);
    var prev = cur - 1, next = cur + 1;
    var html = '';
    if (prev >= 1) {
      html += '<a class="lesson-nav-btn glass" href="lesson.html?id=' + prev + '">' +
        '<div class="dir">← Урок ' + prev + '</div>' +
        '<div class="name">Предыдущий</div>' +
      '</a>';
    } else {
      html += '<div class="lesson-nav-btn glass disabled">' +
        '<div class="dir">←</div>' +
        '<div class="name">Это первый</div>' +
      '</div>';
    }
    html += '<a class="lesson-nav-btn glass next" href="lesson.html?id=' + next + '">' +
      '<div class="dir">Урок ' + next + ' →</div>' +
      '<div class="name">Следующий</div>' +
    '</a>';
    return html;
  }

  function countInteractive() {
    var L = STATE.lesson;
    if (!L.exercises) return 0;
    return L.exercises.filter(function (e) { return e.type !== 'placeholder'; }).length;
  }

  // ---------- ОБРАБОТЧИКИ ----------
  function attachSegments() {
    document.querySelectorAll('.segment').forEach(function (seg) {
      seg.addEventListener('click', function () {
        document.querySelectorAll('.segment').forEach(function (s) { s.classList.remove('active'); });
        document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
        seg.classList.add('active');
        document.getElementById(seg.dataset.tab).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (seg.dataset.tab === 'progress') updateRings();
      });
    });
  }

  function attachDialogue() {
    document.querySelectorAll('.dialogue-line').forEach(function (line) {
      line.querySelector('.line-tr').textContent = line.dataset.tr;
      line.addEventListener('click', function () {
        line.classList.toggle('expanded');
        saveProgress();
        updateRings();
      });
    });
  }

  function attachVocab() {
    document.querySelectorAll('.vocab-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var i = +card.dataset.vocabI;
        card.classList.toggle('flipped');
        if (card.classList.contains('flipped')) {
          STATE.flipped.add(i);
          toast();
        } else {
          STATE.flipped.delete(i);
        }
        saveProgress();
        updateRings();
      });
    });
  }

  function attachExercises() {
    // True/False
    document.querySelectorAll('.tf-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var exNum = btn.dataset.ex;
        var i = +btn.dataset.i;
        var key = exNum + '-' + i;
        if (STATE.tfAnswered.has(key)) return;
        var ex = STATE.lesson.exercises.find(function (e) { return String(e.num) === exNum; });
        var item = ex.items[i];
        var val = btn.dataset.val === 'true';
        var correct = val === item.correct;
        btn.classList.add('selected', correct ? 'ok' : 'no');
        STATE.tfAnswered.set(key, correct);
        var fb = document.getElementById('tf-fb-' + exNum + '-' + i);
        if (correct) {
          fb.className = 'feedback show ok';
          fb.textContent = 'Верно.';
        } else {
          fb.className = 'feedback show no';
          fb.innerHTML = 'Не совсем. ' + (item.hint || '');
        }
        toast();
        saveProgress();
        updateRings();
      });
    });

    // Fill input
    document.querySelectorAll('.ex-input').forEach(function (inp) {
      var handler = function () {
        if (!inp.value.trim()) return;
        var exNum = inp.dataset.ex;
        var i = +inp.dataset.i;
        var ex = STATE.lesson.exercises.find(function (e) { return String(e.num) === exNum; });
        var item = ex.items[i];
        var user = normalizeArabic(inp.value);
        var expected = [item.answer].concat(item.alt || []).map(normalizeArabic);
        var correct = expected.indexOf(user) !== -1;
        inp.classList.remove('correct', 'wrong');
        inp.classList.add(correct ? 'correct' : 'wrong');
        var map = ex.type === 'number_words' ? STATE.numAnswered : STATE.fillAnswered;
        map.set(exNum + '-' + i, correct);
        var fb = document.getElementById('fill-fb-' + exNum + '-' + i);
        if (correct) {
          fb.className = 'feedback show ok';
          fb.textContent = ex.success_msg || 'Верно.';
        } else {
          fb.className = 'feedback show no';
          fb.innerHTML = 'Правильный вариант: <span class="ar-correct">' + item.answer + '</span>';
        }
        toast();
        saveProgress();
        updateRings();
      };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handler(); } });
      inp.addEventListener('blur', handler);
    });

    // Matching
    document.querySelectorAll('.match-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { onMatchClick(chip); });
    });
  }

  function onMatchClick(chip) {
    if (chip.classList.contains('matched')) return;
    var exNum = chip.dataset.ex;
    if (chip.dataset.side === 'left') {
      document.querySelectorAll('.match-chip[data-ex="' + exNum + '"][data-side="left"].selected').forEach(function (c) {
        c.classList.remove('selected');
      });
      chip.classList.add('selected');
      STATE.selectedMatchLeft = chip;
    } else {
      if (!STATE.selectedMatchLeft || STATE.selectedMatchLeft.dataset.ex !== exNum) return;
      var li = +STATE.selectedMatchLeft.dataset.idx;
      var ri = +chip.dataset.idx;
      if (li === ri) {
        STATE.selectedMatchLeft.classList.remove('selected');
        STATE.selectedMatchLeft.classList.add('matched');
        chip.classList.add('matched');
        if (!STATE.matchAnswered.has(exNum)) STATE.matchAnswered.set(exNum, new Set());
        STATE.matchAnswered.get(exNum).add(li);
        STATE.selectedMatchLeft = null;
        toast();
        saveProgress();
        updateRings();
      } else {
        chip.classList.add('shake');
        setTimeout(function () { chip.classList.remove('shake'); }, 400);
      }
    }
  }

  // ---------- ХАРАКАТЫ ----------
  var arabicTextStore = [];
  function indexAllArabic() {
    arabicTextStore.length = 0;
    var selectors = ['.line-ar', '.example-ar', '.vocab-ar', '.exercise-instr', '.tf-text', '.ex-prompt', '.ar-correct', '.hero-ar', '.grammar-ar', '.parse-word', '.parse-tag', '.ar-row', '.form-cell .ar-form', '.quote-ar'];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var original = el.textContent;
        if (TASHKEEL_REGEX.test(original)) {
          arabicTextStore.push({ el: el, withT: original, without: stripTashkeel(original) });
        }
      });
    });
  }
  function applyTashkeel(show) {
    arabicTextStore.forEach(function (item) {
      item.el.textContent = show ? item.withT : item.without;
    });
  }
  function attachTashkeelToggle() {
    var btn = document.getElementById('tashkeelToggle');
    btn.addEventListener('click', function () {
      var active = btn.classList.toggle('active');
      applyTashkeel(active);
    });
    indexAllArabic();
  }

  // ---------- СОХРАНЕНИЕ ПРОГРЕССА ----------
  function progressKey() {
    return 'lesson-' + String(STATE.lessonId).padStart(2, '0') + '-progress';
  }

  function saveProgress() {
    var data = {
      flipped: Array.from(STATE.flipped),
      tfAnswered: Array.from(STATE.tfAnswered),
      fillAnswered: Array.from(STATE.fillAnswered),
      matchAnswered: Array.from(STATE.matchAnswered).map(function (e) { return [e[0], Array.from(e[1])]; }),
      numAnswered: Array.from(STATE.numAnswered),
      expandedLines: Array.from(document.querySelectorAll('.dialogue-line.expanded')).map(function (el) {
        return Array.from(document.querySelectorAll('.dialogue-line')).indexOf(el);
      }),
      theory: getTheoryPct() * 100,
      vocab: getVocabPct() * 100,
      exercises: getExercisesPct() * 100
    };
    try { localStorage.setItem(progressKey(), JSON.stringify(data)); } catch (e) {}
  }

  function loadProgress() {
    var saved;
    try { saved = localStorage.getItem(progressKey()); } catch (e) {}
    if (!saved) return;
    try {
      var d = JSON.parse(saved);
      STATE.flipped = new Set(d.flipped || []);
      STATE.tfAnswered = new Map(d.tfAnswered || []);
      STATE.fillAnswered = new Map(d.fillAnswered || []);
      STATE.matchAnswered = new Map((d.matchAnswered || []).map(function (e) { return [e[0], new Set(e[1])]; }));
      STATE.numAnswered = new Map(d.numAnswered || []);

      STATE.flipped.forEach(function (i) {
        var card = document.querySelector('.vocab-card[data-vocab-i="' + i + '"]');
        if (card) card.classList.add('flipped');
      });
      (d.expandedLines || []).forEach(function (idx) {
        var lines = document.querySelectorAll('.dialogue-line');
        if (lines[idx]) lines[idx].classList.add('expanded');
      });
      STATE.tfAnswered.forEach(function (correct, key) {
        var parts = key.split('-');
        var exNum = parts[0], i = parts[1];
        var ex = STATE.lesson.exercises.find(function (e) { return String(e.num) === exNum; });
        if (!ex || !ex.items) return;
        var item = ex.items[+i];
        if (!item) return;
        var val = correct ? item.correct : !item.correct;
        var btn = document.querySelector('.tf-btn[data-ex="' + exNum + '"][data-i="' + i + '"][data-val="' + val + '"]');
        if (btn) btn.classList.add('selected', correct ? 'ok' : 'no');
      });
    } catch (e) {
      console.error('Не удалось загрузить прогресс:', e);
    }
  }

  // ---------- КОЛЬЦА ----------
  function getTheoryPct() {
    var total = document.querySelectorAll('.dialogue-line').length || 1;
    var opened = document.querySelectorAll('.dialogue-line.expanded').length;
    return Math.min(1, (opened / total) * 0.6 + STATE.scrollProgress * 0.4);
  }
  function getVocabPct() {
    var total = STATE.lesson.vocab ? STATE.lesson.vocab.length : 1;
    return STATE.flipped.size / total;
  }
  function getExercisesPct() {
    var interactive = (STATE.lesson.exercises || []).filter(function (e) { return e.type !== 'placeholder'; });
    if (!interactive.length) return 0;
    var solved = 0;
    interactive.forEach(function (ex) {
      if (ex.type === 'true_false') {
        var c = Array.from(STATE.tfAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c / ex.items.length >= 0.7) solved++;
      } else if (ex.type === 'fill_inna' || ex.type === 'fill_input' || ex.type === 'questions') {
        var c2 = Array.from(STATE.fillAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c2 / ex.items.length >= 0.7) solved++;
      } else if (ex.type === 'matching') {
        var set = STATE.matchAnswered.get(String(ex.num));
        if (set && set.size === ex.pairs.length) solved++;
      } else if (ex.type === 'number_words') {
        var c3 = Array.from(STATE.numAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c3 / ex.items.length >= 0.7) solved++;
      }
    });
    return solved / interactive.length;
  }

  function setRing(id, pct, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var circ = 2 * Math.PI * 40;
    el.setAttribute('stroke-dashoffset', circ * (1 - pct));
    document.getElementById(id + 'Pct').textContent = Math.round(pct * 100) + '%';
    if (text) document.getElementById(id + 'Detail').textContent = text;
  }

  function updateRings() {
    var tPct = getTheoryPct();
    var total = document.querySelectorAll('.dialogue-line').length;
    var opened = document.querySelectorAll('.dialogue-line.expanded').length;
    setRing('ringTheory', tPct, tPct >= 1 ? 'Пройдено' : (opened + ' из ' + total + ' строк'));

    var vPct = getVocabPct();
    setRing('ringVocab', vPct, STATE.flipped.size + ' из ' + (STATE.lesson.vocab ? STATE.lesson.vocab.length : 0));

    var interactive = countInteractive();
    var solved = 0;
    (STATE.lesson.exercises || []).filter(function (e) { return e.type !== 'placeholder'; }).forEach(function (ex) {
      if (ex.type === 'true_false') {
        var c = Array.from(STATE.tfAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c / ex.items.length >= 0.7) solved++;
      } else if (ex.type === 'fill_inna' || ex.type === 'fill_input' || ex.type === 'questions') {
        var c2 = Array.from(STATE.fillAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c2 / ex.items.length >= 0.7) solved++;
      } else if (ex.type === 'matching') {
        var set = STATE.matchAnswered.get(String(ex.num));
        if (set && set.size === ex.pairs.length) solved++;
      } else if (ex.type === 'number_words') {
        var c3 = Array.from(STATE.numAnswered).filter(function (e) {
          return e[0].indexOf(ex.num + '-') === 0 && e[1];
        }).length;
        if (c3 / ex.items.length >= 0.7) solved++;
      }
    });
    setRing('ringEx', solved / Math.max(1, interactive), solved + ' из ' + interactive);
  }

  window.addEventListener('scroll', function () {
    var theory = document.getElementById('theory');
    if (!theory || !theory.classList.contains('active')) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    STATE.scrollProgress = Math.min(1, window.scrollY / h);
    updateRings();
  }, { passive: true });

  // ---------- СТАРТ ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLesson);
  } else {
    loadLesson();
  }
})();
