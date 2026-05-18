/* cota-nav.js — torna cada card de cota clicável e navega para /revisao/{slug}
 * Funciona em todas as cota-*.html. Também usado em cargo-*.html para
 * salvar o cargo selecionado no localStorage antes de seguir.
 */
(function () {
  function getTopLS() {
    try { return window.top.localStorage; } catch (e) { return window.localStorage; }
  }
  function getTopLoc() {
    try { return window.top.location; } catch (e) { return window.location; }
  }
  function getSlug() {
    try {
      var p = getTopLoc().pathname || '';
      var m = p.match(/^\/(?:cota|cargo)\/([^/?#]+)/);
      if (m) return decodeURIComponent(m[1]).toLowerCase();
    } catch (e) {}
    try {
      var p2 = window.location.pathname || '';
      var m2 = p2.match(/\/(?:cota|cargo)-([a-z]+)\.html/i);
      if (m2) return m2[1].toLowerCase();
    } catch (e) {}
    try { return (getTopLS().getItem('current_concurso') || '').toLowerCase(); } catch (e) {}
    return '';
  }
  function isCotaPage() {
    try { return /\/cota\/|cota-/.test(getTopLoc().pathname || ''); } catch (e) { return false; }
  }
  function isCargoPage() {
    try { return /\/cargo\/|cargo-/.test(getTopLoc().pathname || ''); } catch (e) { return false; }
  }

  function getCardText(card) {
    // Pega o primeiro título visível dentro do card (geralmente em span/strong com font)
    var t = (card.textContent || '').trim();
    return t.replace(/\s+/g, ' ');
  }
  function extractCotaName(text) {
    if (/Opção combinada/i.test(text)) return 'Opção combinada: Cotas Raciais + Pessoa com Deficiência';
    if (/Pessoa com Defici/i.test(text)) return 'Pessoa com Deficiência';
    if (/Cotas Raciais/i.test(text)) return 'Cotas Raciais';
    if (/Ampla Concorr/i.test(text)) return 'Ampla Concorrência';
    return '';
  }
  function extractVagas(text) {
    var m = text.match(/(\d+)\s*vaga/i);
    return m ? m[1] : '';
  }
  function extractCargoData(card) {
    // Pega o texto bruto do card
    var raw = (card.textContent || '').replace(/\s+/g, ' ').trim();
    // Nome do cargo (1ª linha antes de "Vagas/Salário/Requisitos")
    var stopIdx = raw.search(/\d+\s*vaga|Vagas|Requisitos|Salário|R\$/i);
    var nome = stopIdx > 0 ? raw.slice(0, stopIdx).trim() : raw.slice(0, 120);
    // Vagas
    var vagasMatch = raw.match(/(\d+)\s*vaga/i);
    var vagas = vagasMatch ? vagasMatch[1] : '';
    // Requisitos
    var reqMatch = raw.match(/REQUISITOS?:\s*([^•·|]{3,180}?)(?=\s*\d|\s*R\$|\s*$)/i);
    var requisitos = reqMatch ? reqMatch[1].trim() : '';
    // Salário (R$ ...)
    var salMatch = raw.match(/R\$[\s\u00a0]*[\d.,]+/);
    var salario = salMatch ? salMatch[0].replace(/\u00a0/g, ' ') : '';
    return { nome: nome, vagas: vagas, requisitos: requisitos, salario: salario };
  }
  function extractCargoName(text) {
    var clean = text.replace(/\s+/g, ' ').trim();
    var stop = clean.search(/Vagas|Salário|Requisitos|Carga/i);
    if (stop > 0) clean = clean.slice(0, stop).trim();
    return clean.slice(0, 120);
  }

  function bindCards() {
    var slug = getSlug();
    document.querySelectorAll('.p-card.cursor-pointer').forEach(function (card) {
      if (card.getAttribute('data-nav-bound') === '1') return;
      card.setAttribute('data-nav-bound', '1');
      card.style.cursor = 'pointer';

      card.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var text = getCardText(card);

        if (isCotaPage()) {
          var cota = extractCotaName(text);
          if (!cota) return;
          var vagas = extractVagas(text);
          try {
            getTopLS().setItem('selected_cota', cota);
            getTopLS().setItem('selected_cota_vagas', vagas || '');
            getTopLS().setItem('current_concurso', slug);
          } catch (_) {}
          if (slug) {
            try { getTopLoc().href = '/revisao/' + slug; } catch (_) {}
          }
        } else if (isCargoPage()) {
          var d = extractCargoData(card);
          try {
            if (d.nome) getTopLS().setItem('selected_cargo', d.nome);
            if (d.vagas) getTopLS().setItem('selected_cargo_vagas', d.vagas);
            if (d.requisitos) getTopLS().setItem('selected_cargo_requisitos', d.requisitos);
            if (d.salario) getTopLS().setItem('selected_cargo_salario', d.salario);
            getTopLS().setItem('current_concurso', slug);
          } catch (_) {}
          if (slug) {
            try { getTopLoc().href = '/cota/' + slug; } catch (_) {}
          }
        }
      }, true);
    });
  }

  function start() {
    bindCards();
    setTimeout(bindCards, 400);
    setTimeout(bindCards, 1200);
    setTimeout(bindCards, 3000);
    // Sem MutationObserver — evita loops pesados
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
