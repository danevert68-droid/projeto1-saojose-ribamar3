// Wire-up dos botões de sufixo de email (@gmail.com, @hotmail.com, etc.)
// para signup.html e qualquer página de auth com .auth-email-quick
(function(){
  function wire(){
    var quick = document.querySelector('.auth-email-quick');
    var email = document.getElementById('email');
    if (!quick || !email) return false;
    if (quick.dataset.wired === '1') return true;
    quick.dataset.wired = '1';
    quick.querySelectorAll('button').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var suffix = (btn.textContent || '').trim();
        if (!suffix.startsWith('@')) return;
        var v = (email.value || '').trim();
        // Se já tem @ ou domínio, substitui o sufixo
        var atIdx = v.indexOf('@');
        if (atIdx >= 0) v = v.substring(0, atIdx);
        email.value = v + suffix;
        email.dispatchEvent(new Event('input', {bubbles:true}));
        email.dispatchEvent(new Event('change', {bubbles:true}));
        email.focus();
      });
    });
    return true;
  }
  function tryWire(){
    if (wire()) return;
    setTimeout(tryWire, 250);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryWire);
  } else {
    tryWire();
  }
})();
