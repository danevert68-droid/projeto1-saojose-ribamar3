/* back-nav.js — faz o botão de seta "voltar" (.pi-arrow-left) navegar de fato.
 * Como as páginas são exibidas dentro de um iframe pelo React Router,
 * usamos window.top.history.back() para voltar no histórico do navegador.
 * Inclui um fallback caso não exista histórico anterior.
 */
(function () {
  var BIND_ATTR = '__back_nav_bound__';

  // Fallback: para onde voltar quando não há histórico anterior
  function getFallbackUrl() {
    try {
      var path = window.top.location.pathname || '';
      // /cota/{X}  -> /cargo/{X}
      var mCota = path.match(/^\/cota\/([^/?#]+)/);
      if (mCota) return '/cargo/' + mCota[1];
      // /cargo/{X} -> /cadastro?concurso={X}
      var mCargo = path.match(/^\/cargo\/([^/?#]+)/);
      if (mCargo) return '/cadastro?concurso=' + mCargo[1];
      // /cadastro  -> /inscricao
      if (path.indexOf('/cadastro') === 0) return '/inscricao';
      // /inscricao -> /home
      if (path.indexOf('/inscricao') === 0) return '/home';
      // páginas de detalhe de concurso -> /home
      if (/^\/(saude|cajari|educacao|guarda)(\/|$)/.test(path)) return '/home';
    } catch (e) {}
    return '/home';
  }

  function goBack() {
    try {
      var fallback = getFallbackUrl();
      var beforeLen = 0;
      try { beforeLen = window.top.history.length; } catch (e) {}

      // Se houver histórico, tenta voltar
      if (beforeLen > 1) {
        var pathBefore = window.top.location.pathname + window.top.location.search;
        window.top.history.back();
        // Se em 350ms a URL não mudou, usa o fallback
        setTimeout(function () {
          try {
            var pathAfter = window.top.location.pathname + window.top.location.search;
            if (pathAfter === pathBefore) {
              window.top.location.href = fallback;
            }
          } catch (e) {
            window.top.location.href = fallback;
          }
        }, 350);
      } else {
        window.top.location.href = fallback;
      }
    } catch (e) {
      try { window.top.location.href = '/home'; } catch (_) {}
    }
  }

  function bindBackButtons() {
    var icons = document.querySelectorAll('.pi-arrow-left');
    icons.forEach(function (icon) {
      // Sobe até o <button> mais próximo
      var btn = icon.closest('button') || icon.parentElement;
      if (!btn) return;
      if (btn.getAttribute(BIND_ATTR) === '1') return;
      btn.setAttribute(BIND_ATTR, '1');
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        goBack();
      }, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBackButtons);
  } else {
    bindBackButtons();
  }
  // Re-tenta após renders tardios do framework original
  setTimeout(bindBackButtons, 300);
  setTimeout(bindBackButtons, 1200);
  setTimeout(bindBackButtons, 3000);
  // Sem MutationObserver — evita travar a página
})();
