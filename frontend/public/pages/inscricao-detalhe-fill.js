/* inscricao-detalhe-fill.js — Preenche dinamicamente a página de detalhe da inscrição. */
(function () {
  // Taxa de inscrição por nível de escolaridade
  var TAXAS = {
    FUND: 'R$ 81,00',
    MED:  'R$ 115,00',
    SUP:  'R$ 145,00',
  };

  function detectNivel(requisitos, cargo) {
    var src = ((requisitos || '') + ' ' + (cargo || '')).toLowerCase();
    // REGRA 1: qualquer cargo de Professor é sempre SUPERIOR (qualquer série)
    if (/\bprof(?:essor)?\.?\b|\bdocente\b/.test((cargo || '').toLowerCase())) {
      return 'SUP';
    }
    // REGRA 2: detecção pelo texto de requisitos
    if (/\bsuperior\b|licenciatura|bacharel|gradua[cç][aã]o|diploma de curso superior|diploma.*pedagogia|prof\.?\s*superior|pedagogia/.test(src)) {
      return 'SUP';
    }
    if (/fundamental/.test(src)) return 'FUND';
    if (/\bm[eé]dio\b/.test(src)) return 'MED';
    return 'MED';
  }

  // Configuração POR CONCURSO (edital, entidade contratante e prazo de pagamento em dias)
  var CONCURSO_CONFIG = {
    saude: {
      nome: 'CONCURSO PÚBLICO DA SAÚDE DE SÃO JOSÉ DE RIBAMAR - MA',
      edital: 'EDITAL DE ABERTURA Nº 002/2026',
      entidade: 'PREFEITURA MUNICIPAL DE SÃO JOSÉ DE RIBAMAR - MA',
      prazoDias: 19,
    },
    educacao: {
      nome: 'CONCURSO PÚBLICO DA EDUCAÇÃO DE SÃO JOSÉ DE RIBAMAR - MA',
      edital: 'EDITAL DE ABERTURA Nº 001/2026',
      entidade: 'PREFEITURA MUNICIPAL DE SÃO JOSÉ DE RIBAMAR - MA',
      prazoDias: 25,
    },
    guarda: {
      nome: 'CONCURSO PÚBLICO DA GUARDA DE SÃO JOSÉ DE RIBAMAR - MA',
      edital: 'EDITAL DE ABERTURA Nº 003/2026',
      entidade: 'PREFEITURA MUNICIPAL DE SÃO JOSÉ DE RIBAMAR - MA',
      prazoDias: 30,
    },
    cajari: {
      nome: 'CONCURSO PÚBLICO MUNICIPAL DE CAJARI - MA',
      edital: 'EDITAL DE ABERTURA Nº 001/2026',
      entidade: 'PREFEITURA MUNICIPAL DE CAJARI - MA',
      prazoDias: 22,
    },
  };

  function inferSlugFromConcurso(name) {
    if (!name) return '';
    var n = name.toUpperCase();
    if (n.indexOf('SAÚDE') >= 0) return 'saude';
    if (n.indexOf('EDUCAÇÃO') >= 0) return 'educacao';
    if (n.indexOf('GUARDA') >= 0) return 'guarda';
    if (n.indexOf('CAJARI') >= 0) return 'cajari';
    return '';
  }

  function getTopLS() {
    try { return window.top.localStorage; } catch (e) { return window.localStorage; }
  }
  function getTopLoc() { try { return window.top.location; } catch (e) { return window.location; } }
  function getToken() {
    try { return window.top.localStorage.getItem('candidate_token'); }
    catch (e) { try { return localStorage.getItem('candidate_token'); } catch (_) { return null; } }
  }
  function getBackendBase() {
    try { return window.top.location.origin; } catch (e) { return window.location.origin; }
  }
  function getInscId() {
    try {
      var p = getTopLoc().pathname || '';
      var m = p.match(/\/inscricao\/([a-f0-9-]+)/i);
      if (m) return m[1];
    } catch (e) {}
    try {
      var qs = getTopLoc().search || '';
      var m2 = qs.match(/[?&]id=([^&]+)/);
      if (m2) return decodeURIComponent(m2[1]);
    } catch (e) {}
    try { return getTopLS().getItem('last_inscricao_id') || ''; } catch (e) {}
    return '';
  }

  function fmtDate(d) {
    try {
      var dt = (d instanceof Date) ? d : new Date(d);
      var dd = String(dt.getDate()).padStart(2,'0');
      var mm = String(dt.getMonth()+1).padStart(2,'0');
      var yy = dt.getFullYear();
      return dd + '/' + mm + '/' + yy;
    } catch (e) { return ''; }
  }
  function fmtDateTime(d) {
    try {
      var dt = (d instanceof Date) ? d : new Date(d);
      var hh = String(dt.getHours()).padStart(2,'0');
      var mi = String(dt.getMinutes()).padStart(2,'0');
      var ss = String(dt.getSeconds()).padStart(2,'0');
      return fmtDate(dt) + ', ' + hh + ':' + mi + ':' + ss;
    } catch (e) { return ''; }
  }
  function addDays(d, n) {
    var dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
  }

  function buildMap(insc) {
    if (!insc) return {};
    var created = insc.created_at ? new Date(insc.created_at) : new Date();
    // Detecta concurso por nome para escolher config (edital/entidade/prazo)
    var slug = inferSlugFromConcurso(insc.concurso);
    var cfg = CONCURSO_CONFIG[slug] || {
      edital: '',
      entidade: '',
      prazoDias: 19,
    };
    var prazoPagamento = addDays(created, cfg.prazoDias);

    // Vagas e requisitos vêm do que o usuário selecionou nos passos anteriores
    var ls = getTopLS();
    var vagas = '';
    var requisitos = '';
    try {
      vagas = ls.getItem('selected_cargo_vagas') || '';
      requisitos = ls.getItem('selected_cargo_requisitos') || '';
    } catch (e) {}
    var vagasTxt = vagas ? (vagas + ' vaga(s)') : '';
    var requisitosTxt = requisitos ? ('REQUISITOS: ' + requisitos) : '';
    var nivel = detectNivel(requisitos, insc.cargo);
    var taxa = TAXAS[nivel] || TAXAS.MED;

    var idShort = String(insc.id || '').replace(/[^a-f0-9]/gi,'').slice(0, 13).toUpperCase();
    return {
      'Concurso': insc.concurso || '',
      'Edital': cfg.edital,
      'Entidade Contratante': cfg.entidade,
      'Cargo': insc.cargo || '',
      'Requisitos do Cargo': requisitos,
      'Requisitos': requisitos,
      'Vagas': vagasTxt,
      'Modalidade': insc.cota || '',
      'Modalidade de Concorrência': insc.cota || '',
      'Status': 'Pendente de Pagamento',
      'Situação': 'Pendente',
      'Taxa': taxa,
      'Valor': taxa,
      'Prazo': fmtDate(prazoPagamento),
      'Prazo de Pagamento': fmtDate(prazoPagamento),
      'Inscrito em': fmtDateTime(new Date()),
      'Atualizado em': fmtDateTime(new Date()),
      'Inscrição': '#' + idShort,
      // chaves auxiliares para placeholders dinâmicos
      '__edital__': cfg.edital,
      '__entidade__': cfg.entidade,
      '__vagas__': vagasTxt,
      '__requisitos__': requisitosTxt,
    };
  }

  function fillFields(map) {
    // Padrão 1 (span → span): label seguido de irmão com font-semibold OU font-bold
    function isValueSpan(el) {
      if (!el || el.tagName !== 'SPAN') return false;
      var cn = (el.className || '');
      return cn.indexOf('font-semibold') >= 0 || cn.indexOf('font-bold') >= 0;
    }
    document.querySelectorAll('span.text-color-secondary').forEach(function (lblEl) {
      var lbl = (lblEl.textContent || '').trim();
      if (!(lbl in map)) return;
      var sib = lblEl.nextElementSibling;
      while (sib && !isValueSpan(sib)) sib = sib.nextElementSibling;
      if (sib) {
        var v = map[lbl];
        if (v && sib.textContent !== v) sib.textContent = v;
      }
    });
    // Padrão 2 (h4 → p): <h4 class=text-color-secondary>LABEL</h4> + <p class=font-semibold>VALOR</p>
    document.querySelectorAll('h4.text-color-secondary').forEach(function (lblEl) {
      var lbl = (lblEl.textContent || '').trim();
      if (!(lbl in map)) return;
      var sib = lblEl.nextElementSibling;
      while (sib && !(sib.tagName === 'P' && (sib.className || '').indexOf('font-semibold') >= 0)) {
        sib = sib.nextElementSibling;
      }
      if (sib) {
        var v = map[lbl];
        if (v && sib.textContent !== v) sib.textContent = v;
      }
    });
    // Vagas dinâmicas (span criado quando limpamos o template)
    if (map['Vagas']) {
      document.querySelectorAll('.vagas-dyn').forEach(function (el) {
        if (el.textContent !== map['Vagas']) el.textContent = map['Vagas'];
      });
    }
    // Atualiza o título h2/h1 da página com o nome do concurso
    if (map['Concurso']) {
      document.querySelectorAll('h2, h1').forEach(function (h) {
        var t = (h.textContent || '').trim();
        if ((!t || /^CONCURSO/i.test(t) || /carregando/i.test(t)) && h.textContent !== map['Concurso']) {
          h.textContent = map['Concurso'];
        }
      });
    }
    // Atualiza placeholders dinâmicos por classe
    if (map['__edital__']) {
      document.querySelectorAll('.cfg-edital').forEach(function (el) {
        if (el.textContent !== map['__edital__']) el.textContent = map['__edital__'];
      });
    }
    if (map['__entidade__']) {
      document.querySelectorAll('.cfg-entidade').forEach(function (el) {
        if (el.textContent !== map['__entidade__']) el.textContent = map['__entidade__'];
      });
    }
    if (map['__vagas__']) {
      document.querySelectorAll('.cfg-vagas, .vagas-dyn').forEach(function (el) {
        if (el.textContent !== map['__vagas__']) el.textContent = map['__vagas__'];
      });
    }
    if (typeof map['__requisitos__'] === 'string') {
      document.querySelectorAll('.cfg-requisitos').forEach(function (el) {
        if (el.textContent !== map['__requisitos__']) el.textContent = map['__requisitos__'];
      });
    }
  }

  function showLoadingState() {
    fillFields({});
  }

  async function fetchInscricao(id) {
    var token = getToken();
    if (!token || !id) return null;
    try {
      var resp = await fetch(getBackendBase() + '/api/inscricoes/' + encodeURIComponent(id), {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) { return null; }
  }

  function wireBack() {
    document.querySelectorAll('button, a').forEach(function (b) {
      var t = (b.textContent || '').trim();
      if (/^Voltar$/i.test(t) && b.getAttribute('data-back-bound') !== '1') {
        b.setAttribute('data-back-bound', '1');
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { window.top.location.href = '/inscricao'; } catch (_) {}
        }, true);
      }
    });
  }

  // ====== Modal PIX ======
  var PIX_MODAL_ID = 'pix-modal-overlay';

  function getInscId() {
    try {
      var qs = (window.top.location.search || '');
      var m = qs.match(/[?&]id=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    try {
      var p = (window.top.location.pathname || '');
      var m2 = p.match(/\/inscricao\/([a-f0-9-]+)/i);
      if (m2) return m2[1];
    } catch (e) {}
    return '';
  }

  function getTaxaNumber(map) {
    var t = (map && map['Taxa']) || 'R$ 115,00';
    var n = t.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(n).toFixed(2);
  }

  function ensureModal() {
    var existing = document.getElementById(PIX_MODAL_ID);
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.id = PIX_MODAL_ID;
    overlay.setAttribute('style',
      'position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;' +
      'align-items:flex-start;justify-content:center;z-index:99999;padding:32px 16px;overflow-y:auto;');
    overlay.innerHTML = (
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:520px;' +
      'box-shadow:0 25px 50px -12px rgba(0,0,0,.25);overflow:hidden;font-family:inherit;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #e2e8f0;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:#16a34a;font-weight:600;font-size:1.05rem;">' +
            '<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#dcfce7;color:#16a34a;text-align:center;line-height:22px;">✓</span>' +
            'Pagamento Gerado' +
          '</div>' +
          '<button data-pix-close style="background:transparent;border:none;font-size:1.4rem;cursor:pointer;color:#64748b;line-height:1;">×</button>' +
        '</div>' +
        '<div id="pix-modal-body" style="padding:22px;">' +
          '<div id="pix-success-banner" style="background:#dcfce7;border:1px solid #86efac;color:#166534;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:8px;margin-bottom:18px;font-size:.9rem;">' +
            '<span>✓</span><span>Pagamento gerado com sucesso! Pague via PIX.</span>' +
          '</div>' +
          '<div style="text-align:center;margin-bottom:14px;">' +
            '<div style="display:inline-flex;align-items:center;gap:8px;color:#16a34a;font-weight:600;font-size:1rem;">' +
              '<span style="display:inline-block;width:20px;height:20px;">⬚</span> Pague com PIX' +
            '</div>' +
            '<div style="color:#64748b;font-size:.85rem;margin-top:4px;">Escaneie o QR Code ou copie o código</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:center;margin-bottom:18px;">' +
            '<div id="pix-qr-wrap" style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;min-width:230px;min-height:230px;display:flex;align-items:center;justify-content:center;">' +
              '<div style="color:#94a3b8;font-size:.85rem;">Gerando QR Code…</div>' +
            '</div>' +
          '</div>' +
          '<div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:14px;">' +
            '<div style="display:flex;align-items:center;gap:6px;color:#15803d;font-weight:600;margin-bottom:8px;font-size:.9rem;">' +
              '<span>📋</span><span>PIX Copia e Cola</span>' +
            '</div>' +
            '<input id="pix-code-input" readonly style="width:100%;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:.78rem;color:#0f172a;margin-bottom:10px;" value="" />' +
            '<button id="pix-copy-btn" style="width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.95rem;">' +
              '<span>📄</span><span>Copiar Código PIX</span>' +
            '</button>' +
            '<button id="pix-comprovante-btn" data-testid="btn-baixar-comprovante" style="width:100%;background:#1e3a8a;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.95rem;margin-top:10px;">' +
              '<span>⬇</span><span>Baixar Comprovante de Inscrição</span>' +
            '</button>' +
          '</div>' +
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;color:#1e3a8a;font-size:.88rem;">' +
            '<div style="margin-bottom:4px;"><strong>$</strong> Valor: <strong id="pix-valor">—</strong></div>' +
            '<div>📅 Vencimento: <strong id="pix-venc">—</strong></div>' +
          '</div>' +
        '</div>' +
        '<div style="padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;">' +
          '<button data-pix-close style="background:#f1f5f9;color:#334155;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;">✕ Fechar</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelectorAll('[data-pix-close]').forEach(function (b) {
      b.addEventListener('click', closeModal);
    });
    return overlay;
  }

  function openModal() {
    var m = ensureModal();
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    var m = document.getElementById(PIX_MODAL_ID);
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
  }

  async function generatePix(map) {
    var token = getToken();
    var inscId = getInscId();
    if (!token || !inscId) return;

    var valor = getTaxaNumber(map);
    openModal();

    try {
      var resp = await fetch(getBackendBase() + '/api/inscricoes/' + encodeURIComponent(inscId) + '/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ valor: valor }),
      });
      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {}; });
        throw new Error(err.detail || ('HTTP ' + resp.status));
      }
      var data = await resp.json();
      fillPixModal(data, map);
    } catch (e) {
      var wrap = document.getElementById('pix-qr-wrap');
      if (wrap) wrap.innerHTML = '<div style="color:#dc2626;font-size:.85rem;text-align:center;">' + (e.message || 'Erro ao gerar PIX') + '</div>';
    }
  }

  function fillPixModal(data, map) {
    var brcode = data.brcode || '';
    var valor = parseFloat(data.valor || '0').toFixed(2).replace('.', ',');
    // Vencimento = 24h após a geração do PIX
    var d = new Date();
    d.setHours(d.getHours() + 24);
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0');
    var mi = String(d.getMinutes()).padStart(2,'0');
    var venc = dd + '/' + mm + '/' + yy + ' às ' + hh + ':' + mi;

    var wrap = document.getElementById('pix-qr-wrap');
    if (wrap) {
      var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=' + encodeURIComponent(brcode);
      wrap.innerHTML = '<img alt="QR Code Pix" src="' + qrUrl + '" style="display:block;width:220px;height:220px;" />';
    }
    var input = document.getElementById('pix-code-input');
    if (input) input.value = brcode;
    var vEl = document.getElementById('pix-valor');
    if (vEl) vEl.textContent = 'R$ ' + valor;
    var dEl = document.getElementById('pix-venc');
    if (dEl) dEl.textContent = venc;

    var copyBtn = document.getElementById('pix-copy-btn');
    if (copyBtn && copyBtn.getAttribute('data-bound') !== '1') {
      copyBtn.setAttribute('data-bound', '1');
      copyBtn.addEventListener('click', function () {
        var v = document.getElementById('pix-code-input');
        if (!v) return;
        v.select();
        try { document.execCommand('copy'); } catch (e) {}
        try { navigator.clipboard.writeText(v.value); } catch (e) {}
        copyBtn.innerHTML = '<span>✓</span><span>Código copiado!</span>';
        copyBtn.style.background = '#15803d';
        setTimeout(function () {
          copyBtn.innerHTML = '<span>📄</span><span>Copiar Código PIX</span>';
          copyBtn.style.background = '#16a34a';
        }, 2200);
        // Registra evento de cópia (não bloqueia UI)
        try {
          fetch(getBackendBase() + '/api/inscricoes/' + encodeURIComponent(getInscId()) + '/pix/copiado', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() },
          });
        } catch (e) {}
      });
    }

    var pdfBtn = document.getElementById('pix-comprovante-btn');
    if (pdfBtn && pdfBtn.getAttribute('data-bound') !== '1') {
      pdfBtn.setAttribute('data-bound', '1');
      pdfBtn.addEventListener('click', async function () {
        var inscId = getInscId();
        var token = getToken();
        if (!inscId || !token) return;
        var originalHtml = pdfBtn.innerHTML;
        pdfBtn.disabled = true;
        pdfBtn.innerHTML = '<span>⏳</span><span>Gerando comprovante...</span>';
        try {
          var resp = await fetch(getBackendBase() + '/api/inscricoes/' + encodeURIComponent(inscId) + '/comprovante', {
            headers: { 'Authorization': 'Bearer ' + token },
          });
          if (!resp.ok) throw new Error('Falha ao gerar comprovante');
          var blob = await resp.blob();
          var url = window.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'comprovante-inscricao-' + inscId.slice(0, 8) + '.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          pdfBtn.innerHTML = '<span>✓</span><span>Comprovante baixado!</span>';
        } catch (err) {
          pdfBtn.innerHTML = '<span>⚠</span><span>Erro ao gerar. Tente novamente.</span>';
        }
        setTimeout(function () {
          pdfBtn.disabled = false;
          pdfBtn.innerHTML = originalHtml;
        }, 2500);
      });
    }
  }

  function wirePagar(map) {
    document.querySelectorAll('button, a').forEach(function (b) {
      var t = (b.textContent || '').trim();
      if (/^Pagar(\s|$|→)/i.test(t) && b.getAttribute('data-pagar-bound') !== '1') {
        b.setAttribute('data-pagar-bound', '1');
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          generatePix(map);
        }, true);
      }
    });
  }

  async function init() {
    var id = getInscId();
    var insc = await fetchInscricao(id);
    if (!insc) {
      // Sem inscrição encontrada — tenta usar a última criada do localStorage
      try {
        var last = getTopLS().getItem('last_inscricao_id');
        if (last && last !== id) insc = await fetchInscricao(last);
      } catch (e) {}
    }
    var map = buildMap(insc);

    function applyAll() {
      try { fillFields(map); } catch (e) {}
      try { wireBack(); } catch (e) {}
      try { wirePagar(map); } catch (e) {}
    }

    applyAll();
    setTimeout(applyAll, 400);
    setTimeout(applyAll, 1200);
    setTimeout(applyAll, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
