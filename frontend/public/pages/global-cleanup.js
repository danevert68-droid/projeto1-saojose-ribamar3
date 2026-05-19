/* global-cleanup.js
 * Roda em TODAS as páginas legadas do funil:
 *  1. Remove qualquer elemento de WhatsApp do DOM (botões flutuantes, links, ícones)
 *  2. Substitui o cabeçalho "Inscrições: 04/05/2026 a 04/06/2026" pelo nome do
 *     concurso selecionado (lido do query string ou do localStorage)
 */
(function () {
  var CONCURSO_NAMES = {
    saude:    'CONCURSO PÚBLICO DA SAÚDE DE SÃO JOSÉ DE RIBAMAR - MA',
    cajari:   'CONCURSO PÚBLICO MUNICIPAL DE CAJARI - MA',
    educacao: 'CONCURSO PÚBLICO DA EDUCAÇÃO DE SÃO JOSÉ DE RIBAMAR - MA',
    guarda:   'CONCURSO PÚBLICO DA GUARDA DE SÃO JOSÉ DE RIBAMAR - MA',
  };

  function getTopWin() { try { return window.top; } catch (e) { return window; } }
  function getTopLoc() { try { return window.top.location; } catch (e) { return window.location; } }
  function getTopLS() {
    try { return window.top.localStorage; } catch (e) { return window.localStorage; }
  }

  // ====== WhatsApp removal ======
  var WA_SELECTORS = [
    '.layout-whatsapp-button',
    '.whatsapp-floating-btn',
    '.whatsapp-inline-btn',
    '.whatsapp-button',
    '.wp-social-link-whatsapp',
    '.wayra-coc-floating-button',
    '.wayra-coc-floating',
    '[class*="wayra-coc"]',
    'a[href*="wa.me"]',
    'a[href*="api.whatsapp.com"]',
    'a[href*="web.whatsapp.com"]',
    'a[href*="whatsapp.com"]',
  ];

  function removeWhatsApp() {
    WA_SELECTORS.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) { el.remove(); });
      } catch (e) {}
    });
    // Ícones isolados (.pi-whatsapp) - remove o ancestral interativo
    try {
      document.querySelectorAll('.pi-whatsapp, .fa-whatsapp').forEach(function (icon) {
        var btn = icon.closest('a,button');
        (btn || icon).remove();
      });
    } catch (e) {}
  }

  // ====== Título dinâmico ======
  function getConcursoSlug() {
    try {
      // 1. tenta query string da janela top
      var qs = getTopLoc().search || '';
      var m = qs.match(/[?&]concurso=([^&]+)/);
      if (m) return decodeURIComponent(m[1]).toLowerCase();
    } catch (e) {}
    try {
      // 2. tenta extrair do path (/cargo/saude, /cota/educacao, etc.)
      var p = getTopLoc().pathname || '';
      var m2 = p.match(/^\/(?:cargo|cota|cadastro|inscricao|revisao)\/([^/?#]+)/);
      if (m2) return decodeURIComponent(m2[1]).toLowerCase();
    } catch (e) {}
    try {
      // 2b. fallback: extrai do nome do arquivo (cargo-saude.html → saude)
      var p2 = (window.location.pathname || '');
      var m3 = p2.match(/\/(?:cargo|cota)-([a-z]+)\.html/i);
      if (m3) return m3[1].toLowerCase();
    } catch (e) {}
    try {
      // 3. último recurso: localStorage da janela top
      var stored = getTopLS().getItem('current_concurso');
      if (stored) return String(stored).toLowerCase();
    } catch (e) {}
    return '';
  }

  function updateTitle() {
    var slug = getConcursoSlug();
    if (!slug) return;
    // Persiste para próximas páginas saberem qual concurso é
    try { getTopLS().setItem('current_concurso', slug); } catch (e) {}

    var name = CONCURSO_NAMES[slug] || slug.toUpperCase();
    var newTitle = 'Inscrição concurso: ' + name;

    document.querySelectorAll('span, h1, h2, h3, h4, h5, h6, p, div').forEach(function (el) {
      if (el.children.length > 0) return; // só folhas
      var txt = (el.textContent || '').trim();
      if (/^Inscri[çc][õo]es:\s*\d{2}\/\d{2}\/\d{4}/.test(txt) && el.textContent !== newTitle) {
        el.textContent = newTitle;
        el.style.fontWeight = '600';
      }
    });
  }


  function wireTopNav() {
    var navMap = [
      { rx: /^In(í|i)cio$/i, path: '/home' },
      { rx: /^Inscri(ç|c)(õ|o)es$/i, path: '/inscricoes' },
      { rx: /^Concursos\s+abertos$/i, path: '/inscricao' },
    ];
    document.querySelectorAll('a, button, span, div, li').forEach(function (el) {
      if (el.children.length > 0) return;
      var t = (el.textContent || '').trim();
      if (!t) return;
      navMap.forEach(function (item) {
        if (item.rx.test(t)) {
          var clickable = el.closest('a, button, [role="button"], li') || el;
          if (clickable.getAttribute('data-topnav-bound') === '1') return;
          clickable.setAttribute('data-topnav-bound', '1');
          clickable.style.cursor = 'pointer';
          clickable.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            try { window.top.location.href = item.path; } catch (_) {}
          }, true);
        }
      });
      if (/^Sair$/i.test(t)) {
        var clickable2 = el.closest('a, button, [role="button"], li') || el;
        if (clickable2.getAttribute('data-logout-bound') === '1') return;
        clickable2.setAttribute('data-logout-bound', '1');
        clickable2.style.cursor = 'pointer';
        clickable2.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { window.top.localStorage.removeItem('candidate_token'); } catch (_) {}
          try { window.top.location.href = '/login'; } catch (_) {}
        }, true);
      }
    });
  }




  // === Barra do usuário (sino + email + Sair) — FIXA no cabeçalho do iframe ===
  var _ijkEmail = null;
  function _ijkOrigin() { try { return window.top.location.origin; } catch (e) { return window.location.origin; } }
  function _ijkToken() { try { return window.top.localStorage.getItem('candidate_token'); } catch (e) { return localStorage.getItem('candidate_token'); } }
  async function _ijkFetchEmail() {
    if (_ijkEmail) return _ijkEmail;
    var tk = _ijkToken();
    if (!tk) return null;
    try {
      var r = await fetch(_ijkOrigin() + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      if (!r.ok) return null;
      var d = await r.json();
      _ijkEmail = d.email || d.nome || null;
      return _ijkEmail;
    } catch (_) { return null; }
  }
  function _ijkInjectStyles() {
    if (document.getElementById('ijk-userbar-style')) return;
    var s = document.createElement('style');
    s.id = 'ijk-userbar-style';
    s.textContent = ''
      + '.ijk-userbar{display:inline-flex;align-items:center;gap:18px;margin-left:auto;padding-left:20px;font-family:"Poppins",system-ui,sans-serif;}'
      + '.ijk-userbar .ijk-bell{background:transparent;border:none;padding:4px;cursor:pointer;color:#64748b;display:inline-flex;align-items:center;justify-content:center;}'
      + '.ijk-userbar .ijk-bell:hover{color:#1e3a8a;}'
      + '.ijk-userbar .ijk-user{display:inline-flex;align-items:center;gap:10px;color:#0f172a;font-size:14px;max-width:260px;}'
      + '.ijk-userbar .ijk-user .ijk-uicon{color:#6366f1;display:inline-flex;flex-shrink:0;}'
      + '.ijk-userbar .ijk-user .ijk-uemail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;font-weight:500;}'
      + '.ijk-userbar .ijk-sair{display:inline-flex;align-items:center;gap:8px;padding:4px 6px;background:transparent;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;color:#475569;transition:color .15s;}'
      + '.ijk-userbar .ijk-sair:hover{color:#b91c1c;}';
    document.head.appendChild(s);
  }
  function _ijkLogout(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    try { window.top.localStorage.removeItem('candidate_token'); } catch (_) {}
    try { window.top.location.href = '/login'; } catch (_) { window.location.href = '/login'; }
  }
  function injectUserBar() {
    var header = document.querySelector('header.candidate-shell__topbar');
    if (!header) return;
    if (header.querySelector('.ijk-userbar')) return; // já injetado
    _ijkInjectStyles();
    var bar = document.createElement('div');
    bar.className = 'ijk-userbar';
    bar.setAttribute('data-testid', 'topbar-userbar');
    bar.innerHTML = ''
      + '<button type="button" class="ijk-bell" aria-label="Notificações" data-testid="topbar-bell">'
      + '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
      + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>'
      + '</svg></button>'
      + '<span class="ijk-user" data-testid="topbar-user">'
      + '<span class="ijk-uicon">'
      + '<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
      + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>'
      + '</svg></span>'
      + '<span class="ijk-uemail">Carregando...</span></span>'
      + '<button type="button" class="ijk-sair" data-testid="topbar-sair" aria-label="Sair">'
      + '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
      + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/>'
      + '</svg><span>Sair</span></button>';
    // Insere no topo do header (depois do brand-row, ou no fim do header se não encontrar)
    header.appendChild(bar);
    // Após renderizar, busca o email e preenche
    _ijkFetchEmail().then(function (email) {
      if (!email) return;
      var emailEl = bar.querySelector('.ijk-uemail');
      if (emailEl) emailEl.textContent = email;
      var userSpan = bar.querySelector('.ijk-user');
      if (userSpan) userSpan.setAttribute('title', email);
    });
    var sairBtn = bar.querySelector('.ijk-sair');
    if (sairBtn) sairBtn.addEventListener('click', _ijkLogout, true);
  }

  // ====== Compactação do header em MOBILE (apenas ≤ 781px) ======
  function injectMobileCompactCSS() {
    if (document.getElementById('ijk-mobile-compact-css')) return;
    var s = document.createElement('style');
    s.id = 'ijk-mobile-compact-css';
    s.textContent = ''
      // Compactar SOMENTE em telas pequenas
      + '@media (max-width: 781px){'
      // 1) Barra amarela do topo (telefone, email, ACESSO / CRIAR USUÁRIO)
      + '.top-info{padding:2px 6px !important;}'
      + '.top-info .wp-block-columns{gap:6px !important;margin:0 !important;}'
      + '.top-info .wp-block-column{padding:2px 4px !important;margin:0 !important;flex-basis:auto !important;}'
      + '.top-info .wp-block-columns:not(.is-not-stacked-on-mobile)>.wp-block-column{flex-basis:auto !important;}'
      + '.top-info p,.top-info a,.top-links a{font-size:11px !important;line-height:1.25 !important;margin:0 !important;}'
      + '.top-info figure,.top-info .wp-block-image{margin:0 4px 0 0 !important;display:inline-block !important;vertical-align:middle;}'
      + '.top-info figure img,.top-info .wp-block-image img{width:10px !important;height:10px !important;}'
      // Empilhar telefone/email em linha única, ACESSO logo abaixo
      + '.top-info .header-details .is-layout-flex{justify-content:center !important;gap:10px !important;flex-wrap:wrap !important;}'
      // 2) Logo (Instituto JKMA) - diminuir bastante
      + '.logo-box{padding:6px 10px !important;width:60% !important;max-width:230px !important;margin:0 auto !important;border-radius:0 !important;}'
      + '.logo-box .wp-block-site-logo img,.logo-box img.custom-logo,.logo-box img{max-width:160px !important;width:100% !important;height:auto !important;}'
      // Bloco do logo + paddings dos containers do header
      + '.logo-block{padding:0 !important;}'
      + '.menu-header,.inner-menu-header,.inner-upper-header{padding:4px 8px !important;gap:4px !important;}'
      + '.menu-header .wp-block-columns,.inner-menu-header .wp-block-columns{gap:4px !important;margin:0 !important;}'
      // 3) Ícones sociais menores
      + '.menu-header .wp-block-social-links,.social-block .wp-block-social-links{gap:10px !important;font-size:16px !important;justify-content:center !important;margin:2px 0 !important;}'
      + '.menu-header .wp-social-link,.social-block .wp-social-link{width:26px !important;height:26px !important;}'
      + '.menu-header .wp-block-social-link a,.social-block .wp-block-social-link a{padding:.15em !important;}'
      + '.menu-header .wp-block-social-link svg,.social-block .wp-block-social-link svg{width:13px !important;height:13px !important;}'
      // 4) Remover separadores grandes do header
      + '.menu-header hr,.inner-menu-header hr,.top-info hr{margin:2px 0 !important;}'
      + '.menu-header .wp-block-spacer,.inner-menu-header .wp-block-spacer,.top-info .wp-block-spacer{height:4px !important;min-height:0 !important;}'
      // 5) Cover image (CONCURSO ...) - reduzir altura
      + '.wp-block-cover.inner-cover-img,.wp-block-cover{min-height:200px !important;}'
      + '.inner-cover-img h2{font-size:22px !important;padding:0 12px !important;}'
      + '}'
      // Tela muito pequena (< 480px) - ainda mais compacto
      + '@media (max-width: 480px){'
      + '.top-info p,.top-info a,.top-links a{font-size:10px !important;}'
      + '.logo-box{width:55% !important;max-width:200px !important;padding:4px 8px !important;}'
      + '.logo-box .wp-block-site-logo img,.logo-box img.custom-logo,.logo-box img{max-width:140px !important;}'
      + '.menu-header .wp-social-link,.social-block .wp-social-link{width:24px !important;height:24px !important;}'
      + '.menu-header .wp-block-social-link svg,.social-block .wp-block-social-link svg{width:12px !important;height:12px !important;}'
      + '.inner-cover-img h2{font-size:18px !important;}'
      + '.wp-block-cover.inner-cover-img,.wp-block-cover{min-height:160px !important;}'
      + '}';
    (document.head || document.documentElement).appendChild(s);
  }

  function removeVagasBadge() {
    // Remove qualquer elemento cujo texto seja "X vaga(s) neste cargo" (e seu container pai com background)
    var nodes = document.querySelectorAll('span, div, p, small, strong, em, b, i');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length > 0) continue;
      var t = (el.textContent || '').trim();
      if (!/^\d+\s*vaga\(s\)\s*neste\s*cargo$/i.test(t)) continue;
      // Sobe até 2 niveis procurando o container com background (badge)
      var target = el;
      for (var lvl = 0; lvl < 2; lvl++) {
        if (!target || !target.parentElement) break;
        var p = target.parentElement;
        // Se o pai tem só 1 filho (este badge), remove o pai inteiro
        if (p.children.length === 1) {
          target = p;
        } else {
          break;
        }
      }
      target.remove();
    }
    // Remove p-tag vazios remanescentes (resquício do PrimeReact após retirar o texto interno)
    document.querySelectorAll('.p-tag.p-tag-warning, .p-tag.p-tag-info, .p-tag').forEach(function (tag) {
      var txt = (tag.textContent || '').trim();
      if (txt === '') {
        var parent = tag.parentElement;
        tag.remove();
        if (parent && parent.children.length === 0 && (parent.textContent || '').trim() === '') {
          parent.remove();
        }
      }
    });
  }

  function tick() {
    try { injectMobileCompactCSS(); } catch (e) {}
    try { removeWhatsApp(); } catch (e) {}
    try { updateTitle(); } catch (e) {}
    try { wireTopNav(); } catch (e) {}
    try { injectUserBar(); } catch (e) {}
    try { removeVagasBadge(); } catch (e) {}
  }

  function start() {
    tick();
    setTimeout(tick, 300);
    setTimeout(tick, 800);
    setTimeout(tick, 1800);
    setTimeout(tick, 3500);
    // Sem MutationObserver — evita loop. Os 5 retries cobrem renders tardios.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
