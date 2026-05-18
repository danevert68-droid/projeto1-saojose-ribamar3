/* revisao-fill.js — preenche dinamicamente a página de Revisão final.
 *  - Lê dados do candidato (/api/auth/me) e do localStorage (cadastro_form_data)
 *  - Lê concurso/cargo/cota também do localStorage
 *  - Popula os <span class=font-semibold> baseados no label vizinho
 */
(function () {
  var CONCURSO_NAMES = {
    saude:    'CONCURSO PÚBLICO DA SAÚDE DE SÃO JOSÉ DE RIBAMAR - MA',
    cajari:   'CONCURSO PÚBLICO MUNICIPAL DE CAJARI - MA',
    educacao: 'CONCURSO PÚBLICO DA EDUCAÇÃO DE SÃO JOSÉ DE RIBAMAR - MA',
    guarda:   'CONCURSO PÚBLICO DA GUARDA DE SÃO JOSÉ DE RIBAMAR - MA',
  };

  function getTopLS() {
    try { return window.top.localStorage; } catch (e) { return window.localStorage; }
  }
  function getToken() {
    try { return window.top.localStorage.getItem('candidate_token'); }
    catch (e) { try { return localStorage.getItem('candidate_token'); } catch (_) { return null; } }
  }
  function getBackendBase() {
    try { return window.top.location.origin; } catch (e) { return window.location.origin; }
  }

  function loadFormData() {
    try {
      var raw = getTopLS().getItem('cadastro_form_data');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function getConcursoSlug() {
    try {
      var qs = window.top.location.search || '';
      var m = qs.match(/[?&]concurso=([^&]+)/);
      if (m) return decodeURIComponent(m[1]).toLowerCase();
    } catch (e) {}
    try {
      var p = window.top.location.pathname || '';
      var m2 = p.match(/^\/revisao\/([^/?#]+)/);
      if (m2) return m2[1].toLowerCase();
    } catch (e) {}
    try { return (getTopLS().getItem('current_concurso') || '').toLowerCase(); } catch (e) {}
    return '';
  }

  function fmtCPF(v) {
    var d = String(v || '').replace(/\D/g,'').slice(0,11);
    if (d.length !== 11) return v || '';
    return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);
  }
  function fmtPhone(v) {
    var d = String(v || '').replace(/\D/g,'');
    if (d.length === 11) return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
    if (d.length === 10) return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
    return v || '';
  }
  function fmtCEP(v) {
    var d = String(v || '').replace(/\D/g,'').slice(0,8);
    if (d.length !== 8) return v || '';
    return d.slice(0,5)+'-'+d.slice(5);
  }

  // Mapeia rótulo (texto do <span>.text-color-secondary) → função que retorna o valor
  function buildMap(user) {
    var f = loadFormData();
    function v(key) {
      // tenta id:, name:, dd:, cal:, ph:
      var keys = ['id:'+key, 'name:'+key, 'dd:'+key, 'cal:'+key];
      for (var i=0; i<keys.length; i++) if (f[keys[i]]) return f[keys[i]];
      return '';
    }
    var slug = getConcursoSlug();
    var concursoNome = CONCURSO_NAMES[slug] || (slug ? slug.toUpperCase() : '');
    var orgaoEmissor = v('orgaoEmissor') || v('orgao') || v('issuingBody') || '';
    var rg = v('rg') || v('RG') || '';
    var rgFull = rg ? (orgaoEmissor ? rg + ' (' + orgaoEmissor + ')' : rg) : '';

    return {
      'Nome Completo': (user && user.nome) || v('fullName') || v('nome') || '',
      'CPF': fmtCPF((user && user.cpf) || v('cpf')),
      'RG': rgFull,
      'Data de Nascimento': v('birthDate') || v('dataNascimento') || v('DD/MM/AAAA') || '',
      'Sexo': v('gender') || v('sexo') || '',
      'Estado Civil': v('maritalStatus') || v('estadoCivil') || '',
      'Nome da Mãe': v('motherName') || v('nomeMae') || '',
      'Nome do Pai': v('fatherName') || v('nomePai') || '',
      'Nome Social': v('socialName') || v('nomeSocial') || '',
      'E-mail': (user && user.email) || v('email') || '',
      'Celular': fmtPhone((user && user.telefone) || v('phone') || v('celular') || v('mobile')),
      'CEP': fmtCEP(v('cep') || v('zip') || v('zipCode')),
      'Logradouro': v('street') || v('logradouro') || v('endereco') || '',
      'Número': v('number') || v('numero') || '',
      'Complemento': v('complement') || v('complemento') || '',
      'Bairro': v('neighborhood') || v('bairro') || '',
      'Cidade': v('city') || v('cidade') || '',
      'UF': v('state') || v('uf') || '',
      'Telefone Fixo': fmtPhone(v('landline') || v('phoneFixed') || v('telefoneFixo')),
      'Concurso': concursoNome,
      'Cargo': getTopLS().getItem('selected_cargo') || '',
      'Modalidade de Concorrência': getTopLS().getItem('selected_cota') || '',
      'Vagas para esta modalidade neste cargo': getTopLS().getItem('selected_cota_vagas') || '',
    };
  }

  function fillFields(map) {
    // Cada par é: <span class=text-color-secondary>LABEL</span><span class=font-semibold>VALUE</span>
    document.querySelectorAll('span.text-color-secondary').forEach(function (lblEl) {
      var lbl = (lblEl.textContent || '').trim();
      if (!(lbl in map)) return;
      // procura o próximo <span class=font-semibold> irmão
      var sib = lblEl.nextElementSibling;
      while (sib && !(sib.tagName === 'SPAN' && (sib.className || '').indexOf('font-semibold') >= 0)) {
        sib = sib.nextElementSibling;
      }
      if (sib) {
        var val = map[lbl];
        if (val && sib.textContent !== val) {
          sib.textContent = val;
        }
      }
    });
  }

  async function fetchMe() {
    var token = getToken();
    if (!token) return null;
    try {
      var resp = await fetch(getBackendBase() + '/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) { return null; }
  }

  // Habilita botão "Finalizar Inscrição" quando checkbox dos termos é marcado
  function wireTerms() {
    var box = document.getElementById('terms') ||
              document.querySelector('input[type="checkbox"]');
    if (!box) return;

    // Procura o botão pelo texto (em vez de classe), evitando colisões
    var btn = null;
    document.querySelectorAll('button').forEach(function (b) {
      if (/Finalizar/i.test(b.textContent || '')) btn = b;
    });
    if (!btn) return;

    // Estrutura do PrimeReact (estática): o quadrado visual é .p-checkbox-box
    // (sem handler). Precisamos amarrar o click do quadrado e do label ao input.
    var checkboxRoot = box.closest('.p-checkbox') || null;
    var checkboxBox = checkboxRoot ? checkboxRoot.querySelector('.p-checkbox-box') : null;
    var label = document.querySelector('label[for="terms"]');

    function updateVisual() {
      if (checkboxBox) {
        if (box.checked) {
          checkboxBox.classList.add('p-highlight');
          // estilo inline para garantir feedback visual mesmo sem CSS do PrimeReact
          checkboxBox.style.background = '#3b82f6';
          checkboxBox.style.borderColor = '#3b82f6';
          // injeta um ícone de check se ainda não existe (apenas unicode, sem class pi-check)
          if (!checkboxBox.querySelector('.terms-check-icon')) {
            var span = document.createElement('span');
            span.className = 'terms-check-icon';
            span.setAttribute('aria-hidden', 'true');
            span.style.color = '#fff';
            span.style.fontSize = '0.95rem';
            span.style.fontWeight = '700';
            span.style.lineHeight = '1';
            span.style.display = 'flex';
            span.style.alignItems = 'center';
            span.style.justifyContent = 'center';
            span.style.width = '100%';
            span.style.height = '100%';
            span.textContent = '\u2713';
            checkboxBox.appendChild(span);
          }
        } else {
          checkboxBox.classList.remove('p-highlight');
          checkboxBox.style.background = '';
          checkboxBox.style.borderColor = '';
          var ic = checkboxBox.querySelector('.terms-check-icon');
          if (ic) ic.remove();
          // remove também eventual ícone com class pi-check de tentativas anteriores
          var oldIc = checkboxBox.querySelector('.p-checkbox-icon');
          if (oldIc) oldIc.remove();
        }
      }
    }

    function refresh() {
      if (box.checked) {
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.classList.remove('p-disabled');
      } else {
        btn.disabled = true;
        btn.setAttribute('disabled', 'true');
        btn.classList.add('p-disabled');
      }
      updateVisual();
    }

    function toggle(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      refresh();
    }

    if (box.getAttribute('data-terms-bound') !== '1') {
      box.setAttribute('data-terms-bound', '1');
      box.addEventListener('change', refresh);
    }
    // amarrar clique no quadrado visual
    if (checkboxRoot && checkboxRoot.getAttribute('data-terms-clickable') !== '1') {
      checkboxRoot.setAttribute('data-terms-clickable', '1');
      checkboxRoot.style.cursor = 'pointer';
      checkboxRoot.addEventListener('click', toggle);
    }
    if (label && label.getAttribute('data-terms-clickable') !== '1') {
      label.setAttribute('data-terms-clickable', '1');
      label.addEventListener('click', toggle);
    }
    refresh();
  }

  // Botão Voltar → /cota/{slug}
  function wireBack() {
    document.querySelectorAll('button').forEach(function (b) {
      var t = (b.textContent || '').trim();
      if (/^Voltar$/i.test(t)) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var slug = getConcursoSlug();
          if (slug) {
            try { window.top.location.href = '/cota/' + slug; return; } catch (_) {}
          }
          try { window.top.history.back(); } catch (_) {}
        }, true);
      }
      if (/Finalizar/i.test(t) && b.getAttribute('data-finalizar-bound') !== '1') {
        b.setAttribute('data-finalizar-bound', '1');
        b.addEventListener('click', async function (e) {
          if (b.disabled) return;
          e.preventDefault();
          e.stopPropagation();
          await submitInscricao(b);
        }, true);
      }
    });
  }

  function calcValorForCargo(cargo) {
    var c = String(cargo || '');
    if (/superior|prof\.?|professor|licenciatura|bacharel|nível superior/i.test(c)) return 145;
    if (/m[eé]dio|t[eé]cnico|nível m[eé]dio/i.test(c)) return 115;
    if (/fundamental|nível fundamental/i.test(c)) return 81;
    return 115;
  }

  // Lê o formulário de cadastro salvo no localStorage e mapeia para os campos do backend
  function getCadastroProfile() {
    try {
      var raw = getTopLS().getItem('cadastro_form_data');
      var d = raw ? JSON.parse(raw) : {};
      // Helpers para encontrar valor por múltiplas chaves possíveis
      function pickKey() {
        var args = Array.prototype.slice.call(arguments);
        for (var i = 0; i < args.length; i++) {
          var k = args[i];
          for (var dk in d) {
            if (dk && dk.toLowerCase().indexOf(k.toLowerCase()) >= 0 && d[dk] != null && d[dk] !== '') {
              return d[dk];
            }
          }
        }
        return undefined;
      }
      var profile = {};
      var rg = pickKey('rg', 'identidade');
      if (rg) profile.rg = rg;
      var orgao = pickKey('rg_orgao', 'orgaoEmissor', 'orgao');
      if (orgao) profile.rg_orgao = orgao;
      var nasc = pickKey('birthDate', 'nascimento', 'dataNasc', 'data_nasc');
      if (nasc) profile.data_nascimento = nasc;
      var sexo = pickKey('sexo', 'genero');
      if (sexo) profile.sexo = sexo;
      var ec = pickKey('estadoCivil', 'estado_civil');
      if (ec) profile.estado_civil = ec;
      var nat = pickKey('naturalidade');
      if (nat) profile.naturalidade = nat;
      var nac = pickKey('nacionalidade');
      if (nac) profile.nacionalidade = nac;
      var mae = pickKey('nomeMae', 'nome_mae', 'mae');
      if (mae) profile.nome_mae = mae;
      var pai = pickKey('nomePai', 'nome_pai', 'pai');
      if (pai) profile.nome_pai = pai;
      var esc = pickKey('escolaridade');
      if (esc) profile.escolaridade = esc;
      var tel = pickKey('telefone', 'celular', 'phone');
      if (tel) profile.telefone = tel;
      var cep = pickKey('cep');
      if (cep) profile.cep = cep;
      var logr = pickKey('logradouro', 'endereco', 'rua');
      if (logr) profile.logradouro = logr;
      var num = pickKey('numero');
      if (num) profile.numero = num;
      var bai = pickKey('bairro');
      if (bai) profile.bairro = bai;
      var cid = pickKey('cidade');
      if (cid) profile.cidade = cid;
      var uf = pickKey('uf', 'estado');
      if (uf) profile.uf = uf;
      var cpl = pickKey('complemento');
      if (cpl) profile.complemento = cpl;
      var pcd = pickKey('pcd');
      if (pcd !== undefined) profile.pcd = !!pcd;
      var pcdDesc = pickKey('pcdDescricao', 'pcd_desc');
      if (pcdDesc) profile.pcd_descricao = pcdDesc;
      return profile;
    } catch (e) {
      return {};
    }
  }

  async function submitInscricao(btn) {
    var token = getToken();
    if (!token) {
      try { window.top.alert('Sua sessão expirou. Faça login novamente.'); } catch (_) {}
      try { window.top.location.href = '/login'; } catch (_) {}
      return;
    }
    var slug = getConcursoSlug();
    var concursoNome = CONCURSO_NAMES[slug] || (slug ? slug.toUpperCase() : '');
    var cargo = '';
    var cota = '';
    var cidade = '';
    try {
      cargo = getTopLS().getItem('selected_cargo') || '';
      cota = getTopLS().getItem('selected_cota') || '';
      cidade = getTopLS().getItem('selected_cidade_prova') || '';
    } catch (_) {}

    if (!concursoNome || !cargo || !cota) {
      try { window.top.alert('Dados incompletos: refaça as etapas anteriores.'); } catch (_) {}
      return;
    }

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.classList.add('p-disabled');
    btn.textContent = 'Enviando...';

    try {
      var profile = getCadastroProfile();
      var body = Object.assign({}, profile, {
        concurso: concursoNome,
        cargo: cargo,
        cota: cota,
        cidade_prova: cidade || null,
        valor: calcValorForCargo(cargo),
      });
      var resp = await fetch(getBackendBase() + '/api/inscricoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {}; });
        throw new Error(err.detail || ('Erro ' + resp.status));
      }
      var data = await resp.json();
      // Limpa dados temporários do fluxo (mantém o cadastro_form_data para próximas inscrições)
      try {
        getTopLS().removeItem('selected_cota');
        getTopLS().removeItem('selected_cota_vagas');
        getTopLS().removeItem('selected_cargo');
        getTopLS().setItem('last_inscricao_id', data.id || '');
      } catch (_) {}
      try {
        var dest = data && data.id ? ('/inscricao/' + data.id) : '/inscricao';
        window.top.location.href = dest;
      } catch (_) {}
    } catch (e) {
      console.error('Erro ao finalizar:', e);
      try { window.top.alert('Não foi possível finalizar: ' + (e.message || 'erro inesperado')); } catch (_) {}
      btn.disabled = false;
      btn.classList.remove('p-disabled');
      btn.textContent = originalText;
    }
  }

  async function init() {
    var user = await fetchMe();
    var map = buildMap(user);

    function applyAll() {
      try { fillFields(map); } catch (e) {}
      try { hideTopbarChips(); } catch (e) {}
      try { wireTerms(); } catch (e) {}
      try { wireBack(); } catch (e) {}
    }

    applyAll();
    setTimeout(applyAll, 400);
    setTimeout(applyAll, 1200);
    setTimeout(applyAll, 2500);
    // Stop after 2.5s
  }

  function hideTopbarChips() {
    try {
      document.querySelectorAll('.candidate-shell__icon-link, .candidate-shell__profile').forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
