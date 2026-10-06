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
    fixedExpanded: false,
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
    fixedChips: document.getElementById('fixedChips'),
    fixedDetails: document.getElementById('fixedDetails'),
    btnToggleFixed: document.getElementById('btnToggleFixed'),
    branchToggles: document.getElementById('branchToggles'),
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
    el.kindBadge.className = 'badge kind ' + (comp.kind === 'skill' ? 'skill' : 'agent');
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

    el.fixedChips.innerHTML = fixed
      .map(function (s) {
        return (
          '<span class="chip" title="固定段，始终包含"><span class="lock">🔒</span>' +
          esc(s.titleZh) +
          '</span>'
        );
      })
      .join('');

    el.fixedDetails.innerHTML = fixed
      .map(function (s) {
        var snip = (s.textZh || '').slice(0, 180);
        if ((s.textZh || '').length > 180) snip += '…';
        return (
          '<div class="fixed-item"><strong>' +
          esc(s.titleZh) +
          ' <span style="color:var(--text-dim);font-weight:400">order ' +
          esc(s.order) +
          '</span></strong><pre class="snip">' +
          esc(snip) +
          '</pre></div>'
        );
      })
      .join('');

    el.fixedDetails.classList.toggle('hidden', !state.fixedExpanded);
    el.btnToggleFixed.textContent = state.fixedExpanded ? '收起固定段说明' : '展开固定段说明';

    if (optional.length === 0) {
      el.branchToggles.innerHTML = '';
      el.branchEmpty.hidden = false;
    } else {
      el.branchEmpty.hidden = true;
      el.branchToggles.innerHTML = optional
        .map(function (s) {
          var on = !!state.enabled[s.id];
          return (
            '<div class="toggle-row ' +
            (on ? 'on' : 'off') +
            '" data-seg="' +
            esc(s.id) +
            '">' +
            '<label class="switch">' +
            '<input type="checkbox" data-toggle-seg="' +
            esc(s.id) +
            '"' +
            (on ? ' checked' : '') +
            ' />' +
            '<span class="slider"></span>' +
            '</label>' +
            '<div class="toggle-body">' +
            '<div class="title">' +
            esc(s.titleZh) +
            ' <span style="color:var(--text-dim);font-weight:400;font-size:11px">#' +
            esc(s.order) +
            '</span></div>' +
            '<div class="cond">' +
            esc(s.conditionZh || '（无条件说明）') +
            '</div>' +
            '</div></div>'
          );
        })
        .join('');
    }

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
    state.fixedExpanded = false;
    state.openSources[comp.sourceId] = true;
    initEnabled(comp);
    renderSidebar();
    renderDetail();
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

  el.branchToggles.addEventListener('change', function (e) {
    var input = e.target.closest('[data-toggle-seg]');
    if (!input) return;
    var segId = input.getAttribute('data-toggle-seg');
    state.enabled[segId] = !!input.checked;
    var row = input.closest('.toggle-row');
    if (row) {
      row.classList.toggle('on', input.checked);
      row.classList.toggle('off', !input.checked);
    }
    var comp = getComposition(state.selectedId);
    if (comp) updatePreview(comp);
  });

  el.btnReset.addEventListener('click', function () {
    var comp = getComposition(state.selectedId);
    if (!comp) return;
    initEnabled(comp);
    renderDetail();
  });

  el.btnToggleFixed.addEventListener('click', function () {
    state.fixedExpanded = !state.fixedExpanded;
    el.fixedDetails.classList.toggle('hidden', !state.fixedExpanded);
    el.btnToggleFixed.textContent = state.fixedExpanded ? '收起固定段说明' : '展开固定段说明';
  });

  var toastTimer = null;
  el.btnCopy.addEventListener('click', function () {
    var text = el.preview.textContent || '';
    function showToast() {
      el.copyToast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        el.copyToast.hidden = true;
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showToast).catch(function () {
        fallbackCopy(text);
        showToast();
      });
    } else {
      fallbackCopy(text);
      showToast();
    }
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
  if (compositions.length) {
    selectComposition(compositions[0].id);
  }
})();
