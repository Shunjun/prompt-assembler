(function () {
  'use strict';

  var lab = window.PROMPT_LAB;
  if (!lab || !Array.isArray(lab.sources) || !Array.isArray(lab.compositions)) {
    document.body.innerHTML =
      '<p style="padding:24px;color:#f07178;font-family:sans-serif">数据未加载：请确认与 index.html 同目录存在 data.js。</p>';
    return;
  }

  var sources = lab.sources.slice();
  var compositions = lab.compositions.slice();
  var sourceById = {};
  sources.forEach(function (s) {
    sourceById[s.id] = s;
  });

  var compsBySource = {};
  compositions.forEach(function (c) {
    if (!compsBySource[c.sourceId]) compsBySource[c.sourceId] = [];
    compsBySource[c.sourceId].push(c);
  });

  var state = {
    filter: 'all',
    search: '',
    selectedId: null,
    enabled: {}, // segmentId -> bool
    collapsed: {}, // segmentId -> true when folded (default: all expanded)
    openSources: {},
  };

  var el = {
    sourceList: document.getElementById('sourceList'),
    listCount: document.getElementById('listCount'),
    emptyState: document.getElementById('emptyState'),
    detail: document.getElementById('detail'),
    kindBadge: document.getElementById('kindBadge'),
    sourceBadge: document.getElementById('sourceBadge'),
    compTitle: document.getElementById('compTitle'),
    compDesc: document.getElementById('compDesc'),
    compNote: document.getElementById('compNote'),
    repoLink: document.getElementById('repoLink'),
    licenseNote: document.getElementById('licenseNote'),
    fixedCards: document.getElementById('fixedCards'),
    fixedEmpty: document.getElementById('fixedEmpty'),
    fixedCount: document.getElementById('fixedCount'),
    branchCards: document.getElementById('branchCards'),
    branchCount: document.getElementById('branchCount'),
    segSummary: document.getElementById('segSummary'),
    btnExpandAll: document.getElementById('btnExpandAll'),
    branchEmpty: document.getElementById('branchEmpty'),
    btnReset: document.getElementById('btnReset'),
    preview: document.getElementById('preview'),
    charCount: document.getElementById('charCount'),
    btnCopy: document.getElementById('btnCopy'),
    copyToast: document.getElementById('copyToast'),
    search: document.getElementById('search'),
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normKind(k) {
    return String(k || '').indexOf('skill') === 0 ? 'skill' : 'agent';
  }

  function kindLabel(k) {
    return normKind(k) === 'skill' ? 'Skill' : 'Agent';
  }

  function matchesFilter(item) {
    if (state.filter === 'all') return true;
    return normKind(item.kind) === state.filter;
  }

  function matchesSearch(text) {
    if (!state.search) return true;
    return String(text).toLowerCase().indexOf(state.search) !== -1;
  }

  function filteredSources() {
    var q = state.search;
    return sources.filter(function (src) {
      if (!matchesFilter(src)) return false;
      var comps = (compsBySource[src.id] || []).filter(function (c) {
        return matchesFilter(c) && matchesSearch(c.titleZh + ' ' + src.name + ' ' + (src.blurbZh || ''));
      });
      if (q) {
        var srcHit = matchesSearch(src.name + ' ' + (src.blurbZh || '') + ' ' + src.id);
        return srcHit || comps.length > 0;
      }
      return (compsBySource[src.id] || []).some(matchesFilter);
    });
  }

  function compsForSource(src) {
    return (compsBySource[src.id] || []).filter(function (c) {
      if (!matchesFilter(c)) return false;
      if (!state.search) return true;
      return (
        matchesSearch(c.titleZh) ||
        matchesSearch(src.name) ||
        matchesSearch(src.blurbZh || '') ||
        matchesSearch(c.descriptionZh || '')
      );
    });
  }

  function renderSidebar() {
    var list = filteredSources();
    var html = '';
    var totalComps = 0;

    list.forEach(function (src) {
      var comps = compsForSource(src);
      totalComps += comps.length;
      var isOpen = state.openSources[src.id] !== false; // default open
      if (state.search) isOpen = true;
      if (state.selectedId) {
        var sel = compositions.find(function (c) {
          return c.id === state.selectedId;
        });
        if (sel && sel.sourceId === src.id) isOpen = true;
      }

      html +=
        '<div class="source-group' +
        (isOpen ? ' open' : '') +
        '" data-source="' +
        esc(src.id) +
        '">';
      html +=
        '<button type="button" class="source-btn" data-toggle-source="' +
        esc(src.id) +
        '">' +
        '<span class="chev">▸</span>' +
        '<span class="name">' +
        esc(src.name) +
        '</span>' +
        '<span class="kind-dot ' +
        esc(normKind(src.kind)) +
        '">' +
        esc(kindLabel(src.kind)) +
        '</span>' +
        '</button>';
      html += '<div class="comp-list">';
      comps.forEach(function (c) {
        html +=
          '<button type="button" class="comp-btn' +
          (c.id === state.selectedId ? ' active' : '') +
          '" data-comp="' +
          esc(c.id) +
          '">' +
          esc(c.titleZh) +
          '</button>';
      });
      html += '</div></div>';
    });

    el.sourceList.innerHTML = html || '<p class="hint" style="padding:12px">无匹配项</p>';
    el.listCount.textContent =
      list.length + ' 个来源 · ' + totalComps + ' 个组合（共 ' + compositions.length + '）';
  }

  function getComposition(id) {
    for (var i = 0; i < compositions.length; i++) {
      if (compositions[i].id === id) return compositions[i];
    }
    return null;
  }

  function initEnabled(comp) {
    state.enabled = {};
    (comp.segments || []).forEach(function (seg) {
      if (!seg.always) {
        state.enabled[seg.id] = !!seg.defaultOn;
      }
    });
  }

  function sortedActiveSegments(comp) {
    return (comp.segments || [])
      .filter(function (seg) {
        return seg.always || state.enabled[seg.id];
      })
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
  }

  function buildPrompt(comp) {
    return sortedActiveSegments(comp)
      .map(function (s) {
        return s.textZh || '';
      })
      .join('\n\n---\n\n');
  }

  function countLines(t) {
    return t ? String(t).split('\n').length : 0;
  }

  function segCardHtml(s, isCond) {
    var on = !isCond || !!state.enabled[s.id];
    var folded = !!state.collapsed[s.id];
    var text = s.textZh || '';
    var cls =
      'seg-card ' + (isCond ? 'cond' : 'fixed') + (on ? ' on' : ' off') + (folded ? ' folded' : '');
    var html = '<article class="' + cls + '" data-seg-card="' + esc(s.id) + '">';
    html += '<header class="seg-head">';
    if (isCond) {
      html +=
        '<label class="switch" title="' +
        (on ? '已加入，点击移出' : '未加入，点击加入') +
        '">' +
        '<input type="checkbox" data-toggle-seg="' +
        esc(s.id) +
        '"' +
        (on ? ' checked' : '') +
        ' aria-label="加入此段：' +
        esc(s.titleZh) +
        '" />' +
        '<span class="slider"></span>' +
        '</label>';
    } else {
      html += '<span class="seg-lock" title="固定段，始终包含">🔒</span>';
    }
    html += '<div class="seg-titles">';
    html +=
      '<div class="seg-title-row">' +
      '<span class="seg-badge ' +
      (isCond ? 'cond' : 'fixed') +
      '">' +
      (isCond ? '条件' : '固定') +
      '</span>' +
      '<h4 class="seg-title">' +
      esc(s.titleZh) +
      '</h4>' +
      '<span class="seg-order">#' +
      esc(s.order) +
      '</span>' +
      '</div>';
    if (isCond) {
      html +=
        '<div class="seg-cond"><span class="k">何时加入</span>' +
        esc(s.conditionZh || '（无条件说明）') +
        '</div>';
    } else if (s.conditionZh) {
      html += '<div class="seg-cond"><span class="k">说明</span>' + esc(s.conditionZh) + '</div>';
    }
    html +=
      '<div class="seg-meta">' +
      text.length.toLocaleString('zh-CN') +
      ' 字 · ' +
      countLines(text) +
      ' 行' +
      (isCond ? '<span class="seg-state">' + (on ? '已加入最终提示词' : '未加入（仅预览原文）') + '</span>' : '') +
      '</div>';
    html += '</div>';
    html +=
      '<div class="seg-actions">' +
      '<button type="button" class="btn mini" data-copy-seg="' +
      esc(s.id) +
      '" title="复制此段完整提示词">复制</button>' +
      '<button type="button" class="btn mini ghost" data-fold-seg="' +
      esc(s.id) +
      '" aria-expanded="' +
      (folded ? 'false' : 'true') +
      '">' +
      (folded ? '展开' : '收起') +
      '</button>' +
      '</div>';
    html += '</header>';
    html += '<pre class="seg-text" data-seg-text="' + esc(s.id) + '" tabindex="0"></pre>';
    html += '</article>';
    return html;
  }

  function renderSegCards(container, list, isCond) {
    container.innerHTML = list
      .map(function (s) {
        return segCardHtml(s, isCond);
      })
      .join('');
    // Fill full text via textContent so every character (incl. leading newlines) is preserved exactly.
    list.forEach(function (s) {
      var pre = container.querySelector('[data-seg-text="' + cssEsc(s.id) + '"]');
      if (pre) pre.textContent = s.textZh || '';
    });
  }

  function cssEsc(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    return String(v).replace(/["\\]/g, '\\$&');
  }

  function findSeg(comp, id) {
    var segs = comp.segments || [];
    for (var i = 0; i < segs.length; i++) if (segs[i].id === id) return segs[i];
    return null;
  }

  function updateSegMeta(comp) {
    var segs = comp.segments || [];
    var nFixed = 0;
    var nCond = 0;
    var nOn = 0;
    segs.forEach(function (s) {
      if (s.always) nFixed++;
      else {
        nCond++;
        if (state.enabled[s.id]) nOn++;
      }
    });
    el.segSummary.textContent =
      '共 ' + segs.length + ' 段：固定 ' + nFixed + ' 段 · 条件 ' + nCond + ' 段（已开启 ' + nOn + '）';
    el.branchCount.textContent = nCond ? nOn + ' / ' + nCond + ' 已开启' : '';
    var anyOpen = segs.some(function (s) {
      return !state.collapsed[s.id];
    });
    el.btnExpandAll.textContent = anyOpen ? '全部收起' : '全部展开';
  }

  function renderDetail() {
    var comp = getComposition(state.selectedId);
    if (!comp) {
      el.emptyState.classList.remove('hidden');
      el.detail.classList.add('hidden');
      return;
    }

    el.emptyState.classList.add('hidden');
    el.detail.classList.remove('hidden');

    var src = sourceById[comp.sourceId] || {};
    el.kindBadge.textContent = kindLabel(comp.kind);
    el.kindBadge.className = 'badge kind ' + normKind(comp.kind);
    el.sourceBadge.textContent = src.name || comp.sourceId;
    el.compTitle.textContent = comp.titleZh;
    el.compDesc.textContent = comp.descriptionZh || '';
    el.compNote.textContent = comp.assemblyNoteZh
      ? '拼装说明：' + comp.assemblyNoteZh
      : '';
    el.compNote.style.display = comp.assemblyNoteZh ? '' : 'none';

    if (src.repoUrl) {
      el.repoLink.href = src.repoUrl;
      el.repoLink.textContent = '打开仓库';
      el.repoLink.style.display = '';
    } else {
      el.repoLink.style.display = 'none';
    }
    el.licenseNote.textContent = src.licenseNote || '';

    var fixed = (comp.segments || [])
      .filter(function (s) {
        return s.always;
      })
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
    var optional = (comp.segments || [])
      .filter(function (s) {
        return !s.always;
      })
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });

    renderSegCards(el.fixedCards, fixed, false);
    el.fixedEmpty.hidden = fixed.length > 0;
    el.fixedCount.textContent = fixed.length ? fixed.length + ' 段' : '';

    renderSegCards(el.branchCards, optional, true);
    el.branchEmpty.hidden = optional.length > 0;
    el.btnReset.style.display = optional.length ? '' : 'none';

    updateSegMeta(comp);
    updatePreview(comp);
  }

  function updatePreview(comp) {
    var text = buildPrompt(comp);
    el.preview.textContent = text;
    var n = text.length;
    var lines = text ? text.split('\n').length : 0;
    el.charCount.textContent = n.toLocaleString('zh-CN') + ' 字 · ' + lines + ' 行';
  }

  function selectComposition(id) {
    var comp = getComposition(id);
    if (!comp) return;
    state.selectedId = id;
    state.collapsed = {};
    state.openSources[comp.sourceId] = true;
    initEnabled(comp);
    renderSidebar();
    renderDetail();
    var activeBtn = el.sourceList.querySelector('.comp-btn.active');
    if (activeBtn && activeBtn.scrollIntoView) activeBtn.scrollIntoView({ block: 'nearest' });
    if (history.replaceState) {
      try {
        history.replaceState(null, '', '#' + encodeURIComponent(id));
      } catch (err) {
        /* file:// may refuse; ignore */
      }
    }
  }

  function compFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return null;
    try {
      h = decodeURIComponent(h);
    } catch (err) {
      /* ignore */
    }
    return getComposition(h);
  }

  // Events
  document.querySelectorAll('.filter-tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.filter = tab.getAttribute('data-filter');
      document.querySelectorAll('.filter-tabs .tab').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderSidebar();
    });
  });

  el.search.addEventListener('input', function () {
    state.search = (el.search.value || '').trim().toLowerCase();
    renderSidebar();
  });

  el.sourceList.addEventListener('click', function (e) {
    var tSrc = e.target.closest('[data-toggle-source]');
    if (tSrc) {
      var sid = tSrc.getAttribute('data-toggle-source');
      var currentlyOpen = state.openSources[sid] !== false;
      // if searching, groups force-open; still allow toggle
      state.openSources[sid] = !currentlyOpen;
      renderSidebar();
      return;
    }
    var tComp = e.target.closest('[data-comp]');
    if (tComp) {
      selectComposition(tComp.getAttribute('data-comp'));
    }
  });

  function onSegChange(e) {
    var input = e.target.closest('[data-toggle-seg]');
    if (!input) return;
    var segId = input.getAttribute('data-toggle-seg');
    var on = !!input.checked;
    state.enabled[segId] = on;
    var card = input.closest('.seg-card');
    if (card) {
      card.classList.toggle('on', on);
      card.classList.toggle('off', !on);
      var st = card.querySelector('.seg-state');
      if (st) st.textContent = on ? '已加入最终提示词' : '未加入（仅预览原文）';
      var sw = card.querySelector('.switch');
      if (sw) sw.title = on ? '已加入，点击移出' : '未加入，点击加入';
    }
    var comp = getComposition(state.selectedId);
    if (comp) {
      updateSegMeta(comp);
      updatePreview(comp);
    }
  }

  function onSegClick(e) {
    var comp = getComposition(state.selectedId);
    if (!comp) return;
    var copyBtn = e.target.closest('[data-copy-seg]');
    if (copyBtn) {
      var seg = findSeg(comp, copyBtn.getAttribute('data-copy-seg'));
      if (!seg) return;
      copyText(seg.textZh || '', function () {
        copyBtn.textContent = '已复制';
        copyBtn.classList.add('done');
        clearTimeout(copyBtn._t);
        copyBtn._t = setTimeout(function () {
          copyBtn.textContent = '复制';
          copyBtn.classList.remove('done');
        }, 1400);
      });
      return;
    }
    var foldBtn = e.target.closest('[data-fold-seg]');
    if (foldBtn) {
      var id = foldBtn.getAttribute('data-fold-seg');
      var folded = !state.collapsed[id];
      state.collapsed[id] = folded;
      var card = foldBtn.closest('.seg-card');
      if (card) card.classList.toggle('folded', folded);
      foldBtn.textContent = folded ? '展开' : '收起';
      foldBtn.setAttribute('aria-expanded', folded ? 'false' : 'true');
      updateSegMeta(comp);
    }
  }

  [el.fixedCards, el.branchCards].forEach(function (c) {
    c.addEventListener('change', onSegChange);
    c.addEventListener('click', onSegClick);
  });

  document.getElementById('btnJumpPreview').addEventListener('click', function () {
    var panel = document.querySelector('.preview-panel');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  el.btnExpandAll.addEventListener('click', function () {
    var comp = getComposition(state.selectedId);
    if (!comp) return;
    var segs = comp.segments || [];
    var anyOpen = segs.some(function (s) {
      return !state.collapsed[s.id];
    });
    segs.forEach(function (s) {
      state.collapsed[s.id] = anyOpen;
    });
    document.querySelectorAll('.seg-card').forEach(function (card) {
      card.classList.toggle('folded', anyOpen);
      var fb = card.querySelector('[data-fold-seg]');
      if (fb) {
        fb.textContent = anyOpen ? '展开' : '收起';
        fb.setAttribute('aria-expanded', anyOpen ? 'false' : 'true');
      }
    });
    updateSegMeta(comp);
  });

  el.btnReset.addEventListener('click', function () {
    var comp = getComposition(state.selectedId);
    if (!comp) return;
    initEnabled(comp);
    renderDetail();
  });

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  var toastTimer = null;
  el.btnCopy.addEventListener('click', function () {
    copyText(el.preview.textContent || '', function () {
      el.copyToast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        el.copyToast.hidden = true;
      }, 1600);
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      /* ignore */
    }
    document.body.removeChild(ta);
  }

  // Init: open all sources by default
  sources.forEach(function (s) {
    state.openSources[s.id] = true;
  });
  renderSidebar();

  // Auto-select first composition for better first paint
  var initial = compFromHash() || compositions[0];
  if (initial) {
    selectComposition(initial.id);
  }

  window.addEventListener('hashchange', function () {
    var c = compFromHash();
    if (c && c.id !== state.selectedId) selectComposition(c.id);
  });
})();
