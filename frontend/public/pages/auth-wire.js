/* auth-wire.js — conecta os forms estáticos de login.html e signup.html ao backend FastAPI.
 * Como o HTML fica dentro de um iframe servido pelo React Router, usamos window.top
 * para gravar o token e navegar para /inscricao após sucesso.
 *
 * Este arquivo é apenas referência — ele é injetado INLINE em cada HTML para
 * driblar a CSP que bloqueia <script src>.
 */
(function () {
  function getBackendBase() {
    try {
      // Quando dentro do iframe, herda a origem do parent (mesmo domínio)
      return window.top.location.origin;
    } catch (e) {
      return window.location.origin;
    }
  }

  function isLoginPage() {
    return /login\.html/i.test(window.location.pathname);
  }
  function isSignupPage() {
    return /signup\.html/i.test(window.location.pathname);
  }

  function hideExpiredWarning() {
    document.querySelectorAll('*').forEach(function (el) {
      if (el.children.length === 0) return;
    });
    // Procura mensagem "Sua sessão expirou" — qualquer elemento que contenha esse texto
    document.body && document.body.innerHTML && void 0;
    document.querySelectorAll('div, p, span').forEach(function (el) {
      if (el.children.length === 0 && /sess(ã|a)o\s+expirou/i.test(el.textContent || '')) {
        var box = el.closest('.p-message, .p-inline-message, [role="status"]') || el;
        if (box && box.style) box.style.display = 'none';
      }
    });
  }

  function clearAllAuthErrors() {
    ['__auth_error__', '__cpf_hint__', '__pwd_match_hint__', '__login_required_hint__'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function showError(msg) {
    var existing = document.getElementById('__auth_error__');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = '__auth_error__';
    div.textContent = msg;
    div.style.cssText =
      'background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:13px;margin:14px 0;font-family:inherit;';
    // tenta colocar antes do botão submit
    var btn = document.querySelector('button[type="submit"]');
    if (btn && btn.parentElement) {
      btn.parentElement.insertBefore(div, btn);
    } else {
      document.body && document.body.appendChild(div);
    }
    setTimeout(function () {
      if (div && div.parentNode) div.parentNode.removeChild(div);
    }, 6000);
  }

  function setSubmitBusy(form, busy, defaultText) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    // Snapshot do HTML original (uma vez só por página) para garantir restauração correta
    if (!btn.hasAttribute('data-original-html')) {
      btn.setAttribute('data-original-html', btn.innerHTML);
    }
    if (busy) {
      btn.disabled = true;
      btn.innerHTML = (defaultText || 'Enviando...');
      btn.style.opacity = '0.75';
      btn.setAttribute('data-busy', '1');
    } else {
      btn.innerHTML = btn.getAttribute('data-original-html') || btn.innerHTML;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.removeAttribute('data-busy');
    }
  }

  function isSubmitting(form) {
    var btn = form && form.querySelector('button[type="submit"]');
    return !!(btn && btn.getAttribute('data-busy') === '1');
  }

  function updateGreeting() {
    // Atualiza o "Boa tarde/Bom dia/Boa noite, concurseiro!" dinamicamente
    var h1 = document.querySelector('h1');
    if (!h1) return;
    var text = h1.textContent || '';
    if (!/concurseiro/i.test(text)) return;
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    h1.textContent = greeting + ', concurseiro!';
  }

  function navigateTop(path) {
    try {
      window.top.location.href = path;
    } catch (e) {
      window.location.href = path;
    }
  }

  function setTopToken(key, token) {
    try {
      window.top.localStorage.setItem(key, token);
    } catch (e) {
      try { localStorage.setItem(key, token); } catch (_) {}
    }
  }

  function rewriteLinks() {
    // Reescreve links externos para rotas internas do React
    var map = [
      { match: /\/auth\/register/, to: '/signup' },
      { match: /\/auth\/login/, to: '/login' },
      { match: /\/auth\/forgot-password/, to: '/login' }, // sem fluxo ainda
    ];
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      // Mantém WhatsApp e e-mail intactos
      if (/^(mailto:|tel:|https?:\/\/(api\.whatsapp|wa\.me))/i.test(href)) return;

      // "Ver Concursos Abertos" → exige login na página de login (mostra aviso vermelho)
      if (/\/concursos-abertos/.test(href) && isLoginPage()) {
        a.removeAttribute('target');
        a.setAttribute('href', '#');
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          showLoginRequiredHint(a);
        }, true);
        return;
      }
      // Em outras páginas, leva para /home
      if (/\/concursos-abertos/.test(href)) {
        a.setAttribute('href', '/home');
        a.removeAttribute('target');
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          navigateTop('/home');
        }, true);
        return;
      }

      for (var i = 0; i < map.length; i++) {
        if (map[i].match.test(href)) {
          a.setAttribute('href', map[i].to);
          a.removeAttribute('target');
          a.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            navigateTop(this.getAttribute('href'));
          }, true);
          break;
        }
      }
    });
  }

  function showLoginRequiredHint(anchor) {
    var existing = document.getElementById('__login_required_hint__');
    if (existing) existing.remove();
    var hint = document.createElement('div');
    hint.id = '__login_required_hint__';
    hint.textContent = 'Faça login para visualizar os concursos abertos.';
    hint.style.cssText =
      'color:#dc2626;font-size:12px;font-weight:500;' +
      'margin-top:8px;text-align:center;font-family:inherit;' +
      'animation:lrHint 0.18s ease-out;';
    // Insere logo abaixo do botão "Ver Concursos Abertos"
    var parent = anchor.parentElement || anchor;
    if (anchor.nextSibling) parent.insertBefore(hint, anchor.nextSibling);
    else parent.appendChild(hint);
    // CSS de animação (uma vez só)
    if (!document.getElementById('__lr_hint_css__')) {
      var st = document.createElement('style');
      st.id = '__lr_hint_css__';
      st.textContent = '@keyframes lrHint{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(st);
    }
    setTimeout(function () {
      if (hint && hint.parentNode) {
        hint.style.transition = 'opacity 0.3s';
        hint.style.opacity = '0';
        setTimeout(function () { hint.remove(); }, 320);
      }
    }, 4000);
  }

  function addBackButton() {
    if (document.getElementById('__auth_back_btn__')) return;
    var btn = document.createElement('button');
    btn.id = '__auth_back_btn__';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Voltar');
    btn.innerHTML = '<span style="font-size:18px;line-height:1">‹</span><span>Voltar</span>';
    btn.style.cssText =
      'position:fixed;top:20px;left:20px;z-index:99998;' +
      'display:inline-flex;align-items:center;gap:8px;' +
      'padding:8px 16px 8px 12px;' +
      'background:#ffffff;border:1.5px solid #e2e8f0;' +
      'border-radius:10px;cursor:pointer;' +
      'font-family:inherit;font-size:14px;font-weight:600;' +
      'color:#475569;letter-spacing:0.2px;' +
      'box-shadow:0 4px 12px rgba(15,23,42,0.08);' +
      'transition:transform 0.15s, box-shadow 0.2s, border-color 0.15s, color 0.15s;';
    btn.onmouseenter = function () {
      btn.style.borderColor = '#3b82f6';
      btn.style.color = '#1d4ed8';
      btn.style.transform = 'translateX(-2px)';
      btn.style.boxShadow = '0 6px 16px rgba(15,23,42,0.12)';
    };
    btn.onmouseleave = function () {
      btn.style.borderColor = '#e2e8f0';
      btn.style.color = '#475569';
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)';
    };
    btn.onclick = function () {
      try {
        var len = 0;
        try { len = window.top.history.length; } catch (e) {}
        var pathBefore = '';
        try { pathBefore = window.top.location.pathname + window.top.location.search; } catch (e) {}
        if (len > 1) {
          window.top.history.back();
          setTimeout(function () {
            try {
              var pathAfter = window.top.location.pathname + window.top.location.search;
              if (pathAfter === pathBefore) navigateTop('/home');
            } catch (e) { navigateTop('/home'); }
          }, 350);
        } else {
          navigateTop('/home');
        }
      } catch (e) {
        navigateTop('/home');
      }
    };
    document.body && document.body.appendChild(btn);
  }

  // ===== LOGIN =====
  function wireLogin() {
    var form = document.querySelector('form');
    if (!form) return;
    var inputs = form.querySelectorAll('input');
    var identifier = inputs[0];
    var senha = form.querySelector('input[type="password"]');
    if (!identifier || !senha) return;

    // Olhinho funcional
    wirePasswordToggle(senha);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isSubmitting(form)) return; // bloqueia double-submit
      var idVal = (identifier.value || '').trim();
      var pwVal = senha.value || '';
      if (!idVal || !pwVal) {
        showError('Preencha e-mail/CPF e senha.');
        return;
      }
      setSubmitBusy(form, true, 'Entrando...');
      try {
        var resp = await fetch(getBackendBase() + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: idVal, senha: pwVal }),
        });
        var data = await resp.json();
        if (!resp.ok) {
          // 401 = credenciais incorretas/inexistente → mensagem padronizada
          var msg = resp.status === 401
            ? 'Usuário inválido ou não cadastrado.'
            : (typeof data.detail === 'string' ? data.detail : 'Falha no login.');
          showError(msg);
          setSubmitBusy(form, false);
          return;
        }
        setTopToken('candidate_token', data.token);
        clearAllAuthErrors();
        try {
          var inscResp = await fetch(getBackendBase() + '/api/inscricoes/minhas', {
            headers: { 'Authorization': 'Bearer ' + data.token },
          });
          if (inscResp.ok) {
            var inscList = await inscResp.json();
            if (Array.isArray(inscList) && inscList.length >= 2) {
              navigateTop('/inscricoes');
              return;
            }
            if (Array.isArray(inscList) && inscList.length === 1 && inscList[0].id) {
              navigateTop('/inscricao/' + inscList[0].id);
              return;
            }
          }
        } catch (_) {}
        navigateTop('/inscricao');
      } catch (err) {
        showError('Erro de conexão. Tente novamente.');
        setSubmitBusy(form, false);
      }
    }, true);
  }

  // ===== SIGNUP =====
  function isValidCPF(cpf) {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // 11111111111, 00000000000 etc.
    var sum = 0, rest;
    for (var i = 1; i <= 9; i++) sum += parseInt(cpf.charAt(i - 1), 10) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.charAt(9), 10)) return false;
    sum = 0;
    for (i = 1; i <= 10; i++) sum += parseInt(cpf.charAt(i - 1), 10) * (12 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    return rest === parseInt(cpf.charAt(10), 10);
  }

  function maskCPF(value) {
    var d = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  function setCPFError(input, msg) {
    input.style.borderColor = '#dc2626';
    input.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)';
    var hintId = '__cpf_hint__';
    var existing = document.getElementById(hintId);
    if (existing) existing.remove();
    if (!msg) return;
    var hint = document.createElement('div');
    hint.id = hintId;
    hint.textContent = msg;
    hint.style.cssText = 'color:#dc2626;font-size:12px;font-weight:500;margin-top:6px;font-family:inherit;';
    var parent = input.parentElement;
    if (parent) parent.appendChild(hint);
  }
  function clearCPFError(input) {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    var h = document.getElementById('__cpf_hint__');
    if (h) h.remove();
  }

  function wirePasswordToggle(input) {
    if (!input || input.getAttribute('data-eye-bound') === '1') return;
    input.setAttribute('data-eye-bound', '1');
    // O ícone <i> de olho é irmão do input, dentro do mesmo wrapper p-password
    var icon = input.nextElementSibling;
    while (icon && icon.tagName && icon.tagName.toLowerCase() !== 'i') icon = icon.nextElementSibling;
    if (!icon) {
      var parent = input.parentElement;
      icon = parent ? parent.querySelector('i') : null;
    }
    if (!icon) return;
    icon.style.cursor = 'pointer';
    icon.style.pointerEvents = 'auto';
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', 'Mostrar/ocultar senha');
    icon.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (input.type === 'password') {
        input.type = 'text';
        // Ícone alternado: usa SVG simples pra evitar dependência da fonte pi
        icon.style.opacity = '1';
        icon.setAttribute('data-shown', '1');
      } else {
        input.type = 'password';
        icon.style.opacity = '';
        icon.removeAttribute('data-shown');
      }
    });
  }

  function setPwdMatchHint(senha, senha2) {
    var hintId = '__pwd_match_hint__';
    var existing = document.getElementById(hintId);
    if (existing) existing.remove();
    if (!senha2.value) {
      senha2.style.borderColor = '';
      senha2.style.boxShadow = '';
      return true;
    }
    var match = senha.value === senha2.value;
    if (match) {
      senha2.style.borderColor = '#10b981';
      senha2.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)';
      return true;
    }
    senha2.style.borderColor = '#dc2626';
    senha2.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)';
    var hint = document.createElement('div');
    hint.id = hintId;
    hint.textContent = 'As senhas não coincidem.';
    hint.style.cssText = 'color:#dc2626;font-size:12px;font-weight:500;margin-top:6px;font-family:inherit;';
    var parent = senha2.parentElement;
    if (parent) {
      // Anexa no container do par "Confirmar senha" — usa o avô para ficar abaixo da linha
      var grand = parent.parentElement || parent;
      grand.appendChild(hint);
    }
    return false;
  }

  function wireSignup() {
    var form = document.querySelector('form');
    if (!form) return;
    var nome = document.getElementById('fullName') || form.querySelector('input[type="text"]');
    var email = document.getElementById('email');
    var cpf = document.getElementById('cpf');
    var pwds = form.querySelectorAll('input[type="password"]');
    var senha = pwds[0];
    var senha2 = pwds[1];
    if (!nome || !email || !cpf || !senha || !senha2) return;

    // Olhinhos funcionais
    wirePasswordToggle(senha);
    wirePasswordToggle(senha2);

    // Validação em tempo real das senhas (precisa funcionar mesmo após type toggle)
    function checkMatch() { setPwdMatchHint(senha, senha2); }
    if (!senha.getAttribute('data-match-bound')) {
      senha.setAttribute('data-match-bound', '1');
      senha.addEventListener('input', checkMatch);
    }
    if (!senha2.getAttribute('data-match-bound')) {
      senha2.setAttribute('data-match-bound', '1');
      senha2.addEventListener('input', checkMatch);
    }

    // Aplica máscara + limite de 11 dígitos enquanto digita
    if (!cpf.getAttribute('data-cpf-bound')) {
      cpf.setAttribute('data-cpf-bound', '1');
      cpf.setAttribute('inputmode', 'numeric');
      cpf.setAttribute('maxlength', '14'); // 000.000.000-00
      cpf.addEventListener('input', function () {
        var raw = cpf.value.replace(/\D/g, '').slice(0, 11);
        cpf.value = maskCPF(raw);
        if (raw.length === 0) {
          clearCPFError(cpf);
        } else if (raw.length < 11) {
          clearCPFError(cpf);
        } else if (!isValidCPF(raw)) {
          setCPFError(cpf, 'CPF inválido. Verifique os dígitos.');
        } else {
          clearCPFError(cpf);
        }
      });
      cpf.addEventListener('blur', function () {
        var raw = cpf.value.replace(/\D/g, '');
        if (raw && !isValidCPF(raw)) {
          setCPFError(cpf, 'CPF inválido. Verifique os dígitos.');
        }
      });
    }

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isSubmitting(form)) return; // bloqueia double-submit
      var nomeVal = (nome.value || '').trim();
      var emailVal = (email.value || '').trim().toLowerCase();
      var cpfVal = (cpf.value || '').replace(/\D/g, '');
      var senhaVal = senha.value || '';
      var senha2Val = senha2.value || '';
      if (!nomeVal || nomeVal.length < 3) return showError('Nome deve ter pelo menos 3 letras.');
      if (!emailVal || !/.+@.+\..+/.test(emailVal)) return showError('E-mail inválido.');
      if (cpfVal.length !== 11) {
        setCPFError(cpf, 'CPF inválido. Verifique os dígitos.');
        showError('CPF inválido. Por favor, verifique.');
        return;
      }
      if (!isValidCPF(cpfVal)) {
        setCPFError(cpf, 'CPF inválido. Verifique os dígitos.');
        showError('CPF inválido. Por favor, verifique.');
        return;
      }
      if (senhaVal.length < 6) return showError('Senha deve ter pelo menos 6 caracteres.');
      if (senhaVal !== senha2Val) return showError('As senhas não coincidem.');

      setSubmitBusy(form, true, 'Criando conta...');
      try {
        var resp = await fetch(getBackendBase() + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nomeVal,
            cpf: cpfVal,
            email: emailVal,
            telefone: '',
            senha: senhaVal,
          }),
        });
        var data = await resp.json();
        if (!resp.ok) {
          showError(typeof data.detail === 'string' ? data.detail : 'Falha ao criar conta.');
          setSubmitBusy(form, false);
          return;
        }
        setTopToken('candidate_token', data.token);
        clearAllAuthErrors();
        navigateTop('/inscricao');
      } catch (err) {
        showError('Erro de conexão. Tente novamente.');
        setSubmitBusy(form, false);
      }
    }, true);
  }

  function init() {
    rewriteLinks();
    hideExpiredWarning();
    addBackButton();
    updateGreeting();
    if (isLoginPage()) wireLogin();
    if (isSignupPage()) wireSignup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();
