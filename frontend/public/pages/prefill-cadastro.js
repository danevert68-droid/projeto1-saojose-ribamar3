/* prefill-cadastro.js — auto-preenche e PERSISTE os dados do formulário de inscrição.
 *
 * 1) Puxa nome/CPF/e-mail/telefone do candidato logado (/api/auth/me)
 * 2) Carrega do localStorage todos os outros campos já preenchidos antes
 *    (válido inclusive entre concursos diferentes), incluindo dropdowns
 *    customizados (Sexo, Estado Civil, UF) e campo de Data de Nascimento.
 * 3) Salva no localStorage qualquer campo que o usuário digitar/selecionar
 * 4) Substitui o título "Inscrições: 04/05/2026 a 04/06/2026" pelo
 *    nome do concurso atual (mantido aqui como fallback se global-cleanup
 *    não estiver carregado).
 */
(function () {
  var CONCURSO_NAMES = {
    saude:    'CONCURSO PÚBLICO DA SAÚDE DE SÃO JOSÉ DE RIBAMAR - MA',
    cajari:   'CONCURSO PÚBLICO MUNICIPAL DE CAJARI - MA',
    educacao: 'CONCURSO PÚBLICO DA EDUCAÇÃO DE SÃO JOSÉ DE RIBAMAR - MA',
    guarda:   'CONCURSO PÚBLICO DA GUARDA DE SÃO JOSÉ DE RIBAMAR - MA',
  };

  // Dropdowns customizados (Prime-React style) que precisam de tratamento especial
  var CUSTOM_DROPDOWN_IDS = ['gender', 'maritalStatus', 'state'];

  function getBackendBase() {
    try { return window.top.location.origin; } catch (e) { return window.location.origin; }
  }
  function getToken() {
    try { return window.top.localStorage.getItem('candidate_token'); }
    catch (e) { try { return localStorage.getItem('candidate_token'); } catch (_) { return null; } }
  }
  function getTopLS() {
    try { return window.top.localStorage; } catch (e) { return window.localStorage; }
  }
  function getConcursoSlug() {
    try {
      var qs = window.top.location.search || '';
      var m = qs.match(/concurso=([^&]+)/);
      return m ? decodeURIComponent(m[1]).toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function maskCPF(v) {
    var d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }
  function maskPhone(v) {
    var d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 10) {
      return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, function (_, a, b, c) {
        return [a && '(' + a, a && a.length === 2 && ') ', b, c && '-' + c].filter(Boolean).join('');
      });
    }
    return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
  }

  function setNativeValue(el, value) {
    if (!el) return false;
    if ((el.value || '') === String(value || '')) return false;
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function updateTitle() {
    var slug = getConcursoSlug();
    if (!slug) return;
    try { getTopLS().setItem('current_concurso', slug); } catch (e) {}
    var name = CONCURSO_NAMES[slug] || slug.toUpperCase();
    var newTitle = 'Inscrição concurso: ' + name;

    var changed = false;
    document.querySelectorAll('span, h2, h3').forEach(function (el) {
      if (el.children.length > 0) return; // só folhas
      var txt = (el.textContent || '').trim();
      if (/^Inscri[çc]ões:\s*\d{2}\/\d{2}\/\d{4}/.test(txt) && el.textContent !== newTitle) {
        el.textContent = newTitle;
        el.style.fontWeight = '600';
        changed = true;
      }
    });
    if (changed) {
      try { document.title = newTitle; } catch (e) {}
    }
  }

  // ====== Persistência (campos simples) ======
  var FORM_KEY = 'cadastro_form_data';

  function loadFormData() {
    try {
      var raw = getTopLS().getItem(FORM_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveFormData(data) {
    try { getTopLS().setItem(FORM_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function patchFormData(patch) {
    var d = loadFormData();
    Object.keys(patch).forEach(function (k) {
      if (patch[k] == null || patch[k] === '') delete d[k];
      else d[k] = patch[k];
    });
    saveFormData(d);
  }
  function fieldKey(el) {
    if (el.id) return 'id:' + el.id;
    if (el.name) return 'name:' + el.name;
    // Caso especial: input dentro de <span id="birthDate"> (calendar do PrimeReact)
    var cal = el.closest && el.closest('.p-calendar[id]');
    if (cal && cal.id) return 'cal:' + cal.id;
    // Inputs com placeholder único (mais frágil, mas útil)
    var ph = el.getAttribute && el.getAttribute('placeholder');
    if (ph && /^(DD\/MM\/AAAA|dd\/mm\/aaaa)$/i.test(ph)) return 'ph:DD/MM/AAAA';
    return null;
  }
  function isPersistable(el) {
    if (!el || el.disabled) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') return false;
    if (el.readOnly) return false; // ignora inputs internos de dropdown (readonly)
    if (el.getAttribute('aria-haspopup') === 'listbox') return false;
    var type = (el.type || 'text').toLowerCase();
    return ['text', 'email', 'tel', 'number', 'date', 'url'].indexOf(type) >= 0;
  }

  function applyStoredData() {
    var data = loadFormData();
    document.querySelectorAll('input, textarea').forEach(function (el) {
      if (!isPersistable(el)) return;
      var k = fieldKey(el);
      if (!k || data[k] == null || data[k] === '') return;
      if (el.value && el.value.trim()) return; // não sobrescreve o que já tem (ex.: vindo de /me)
      setNativeValue(el, data[k]);
    });
  }

  function attachSavers() {
    document.querySelectorAll('input, textarea').forEach(function (el) {
      if (!isPersistable(el)) return;
      if (el.getAttribute('data-saver-bound') === '1') return;
      el.setAttribute('data-saver-bound', '1');
      el.addEventListener('input', function () {
        var k = fieldKey(el);
        if (!k) return;
        var patch = {};
        patch[k] = el.value && el.value.trim() ? el.value : '';
        patchFormData(patch);
      });
    });
  }

  // ====== Persistência (dropdowns customizados) ======
  function getDropdownLabel(dd) {
    return dd.querySelector('.p-dropdown-label');
  }
  function getDropdownValue(dd) {
    var lbl = getDropdownLabel(dd);
    if (!lbl) return '';
    if (lbl.classList.contains('p-placeholder')) return '';
    var t = (lbl.textContent || '').trim();
    if (!t || t === 'Selecione') return '';
    return t;
  }
  function setDropdownValue(dd, value) {
    if (!dd || !value) return;
    var lbl = getDropdownLabel(dd);
    if (lbl) {
      lbl.textContent = value;
      lbl.classList.remove('p-placeholder');
      lbl.style.color = '#0f172a';
    }
    var sel = dd.querySelector('select');
    if (sel) {
      Array.from(sel.options).forEach(function (op) { op.selected = false; });
      var found = Array.from(sel.options).find(function (op) { return op.text === value; });
      if (!found) {
        found = document.createElement('option');
        found.text = value;
        found.value = value;
        sel.appendChild(found);
      }
      found.selected = true;
      try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }
    var hiddenInput = dd.querySelector('input[aria-haspopup="listbox"]');
    if (hiddenInput) { hiddenInput.value = value; }
  }

  function applyStoredDropdowns() {
    var data = loadFormData();
    CUSTOM_DROPDOWN_IDS.forEach(function (id) {
      var dd = document.getElementById(id);
      if (!dd) return;
      var key = 'dd:' + id;
      var stored = data[key];
      if (!stored) return;
      if (getDropdownValue(dd)) return; // já tem valor → não sobrescreve
      setDropdownValue(dd, stored);
    });
  }

  function attachDropdownSavers() {
    CUSTOM_DROPDOWN_IDS.forEach(function (id) {
      var dd = document.getElementById(id);
      if (!dd) return;
      var lbl = getDropdownLabel(dd);
      if (!lbl) return;
      if (lbl.getAttribute('data-dd-observed') === '1') return;
      lbl.setAttribute('data-dd-observed', '1');

      function persist() {
        var v = getDropdownValue(dd);
        var patch = {};
        patch['dd:' + id] = v || '';
        patchFormData(patch);
      }
      // MutationObserver LOCAL apenas no label — leve, só dispara quando o texto do label muda
      try {
        var mo = new MutationObserver(persist);
        mo.observe(lbl, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
      dd.addEventListener('click', function () {
        setTimeout(persist, 50);
        setTimeout(persist, 250);
        setTimeout(persist, 800);
        setTimeout(persist, 2000);
      });
    });

    // Captura cliques em opções de dropdown que aparecem no overlay (fora do dd raiz)
    if (!document.body.getAttribute('data-dd-options-bound')) {
      document.body.setAttribute('data-dd-options-bound', '1');
      document.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t) return;
        var item = (t.closest && t.closest('.p-dropdown-item, [role="option"]')) || null;
        if (!item) return;
        // Após selecionar uma opção, persiste TODOS os dropdowns conhecidos
        setTimeout(function () {
          CUSTOM_DROPDOWN_IDS.forEach(function (id) {
            var dd = document.getElementById(id);
            if (!dd) return;
            var v = getDropdownValue(dd);
            if (v) {
              var patch = {};
              patch['dd:' + id] = v;
              patchFormData(patch);
            }
          });
        }, 50);
      }, true);
    }
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

  function prefillFromUser(user) {
    if (!user) return;
    var fullName = document.getElementById('fullName');
    if (fullName && !fullName.value && user.nome) setNativeValue(fullName, user.nome);
    var cpf = document.getElementById('cpf');
    if (cpf && !cpf.value && user.cpf) setNativeValue(cpf, maskCPF(user.cpf));
    var email = document.getElementById('email');
    if (email && !email.value && user.email) setNativeValue(email, user.email);
    var phone = document.getElementById('phone');
    if (phone && !phone.value && user.telefone) setNativeValue(phone, maskPhone(user.telefone));
  }

  function applyAll() {
    updateTitle();
    applyStoredData();
    applyStoredDropdowns();
    attachSavers();
    attachDropdownSavers();
  }

  async function init() {
    applyAll();
    var user = await fetchMe();
    prefillFromUser(user);

    // Re-aplica em renders tardios do framework do site original
    setTimeout(function () { applyAll(); prefillFromUser(user); }, 600);
    setTimeout(function () { applyAll(); prefillFromUser(user); }, 1500);
    setTimeout(function () { applyAll(); prefillFromUser(user); }, 3000);
    // Sem MutationObserver — evita loop pesado que trava a página
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
