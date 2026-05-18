(function () {
  // ===== Opções dos dropdowns =====
  var OPTIONS = {
    maritalStatus: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável", "Separado(a)"],
    gender: ["Masculino", "Feminino", "Outro", "Prefiro não informar"],
    state: [
      "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
      "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
      "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    ],
  };

  function unlockInputs() {
    var FAKE = ["Yuri Martins da Silva", "056.793.770-47", "eduardoostertag54@gmail.com"];
    document.querySelectorAll("input, textarea").forEach(function (el) {
      if (el.getAttribute("aria-haspopup") === "listbox") return;
      if (el.disabled) {
        el.disabled = false;
        el.removeAttribute("disabled");
        el.classList.remove("p-disabled");
      }
      if (el.readOnly && el.type !== "hidden") {
        el.readOnly = false;
        el.removeAttribute("readonly");
      }
      if (FAKE.indexOf((el.value || "").trim()) !== -1) {
        el.value = "";
        el.classList.remove("p-filled");
      }
      if (el.getAttribute("inputmode") === "none") {
        el.setAttribute("inputmode", "numeric");
      }
    });
  }

  function applyMask(el, fmt) {
    if (el.dataset.maskApplied) return;
    el.dataset.maskApplied = "1";
    el.addEventListener("input", function () {
      var v = el.value.replace(/\D/g, "");
      var out = "";
      var i = 0;
      for (var p = 0; p < fmt.length && i < v.length; p++) {
        if (fmt[p] === "#") out += v[i++];
        else out += fmt[p];
      }
      el.value = out;
    });
  }

  function validaCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    var s = 0;
    for (var i = 0; i < 9; i++) s += parseInt(cpf.charAt(i)) * (10 - i);
    var r = 11 - (s % 11);
    if (r >= 10) r = 0;
    if (r !== parseInt(cpf.charAt(9))) return false;
    s = 0;
    for (var j = 0; j < 10; j++) s += parseInt(cpf.charAt(j)) * (11 - j);
    r = 11 - (s % 11);
    if (r >= 10) r = 0;
    return r === parseInt(cpf.charAt(10));
  }

  function applyMasks() {
    var cpf = document.getElementById("cpf");
    if (cpf) {
      applyMask(cpf, "###.###.###-##");
      if (!cpf.dataset.cpfValidator) {
        cpf.dataset.cpfValidator = "1";
        cpf.addEventListener("blur", function () {
          if (cpf.value && !validaCPF(cpf.value)) {
            cpf.style.borderColor = "#e24c4c";
            cpf.title = "CPF inválido";
          } else {
            cpf.style.borderColor = "";
            cpf.title = "";
          }
        });
      }
    }

    document.querySelectorAll("input").forEach(function (el) {
      if (el.dataset.maskApplied) return;
      var ph = (el.placeholder || "").toLowerCase();
      var id = (el.id || "").toLowerCase();

      // Ordem importante: padrões mais longos primeiro
      if (ph === "(00) 00000-0000" || id.indexOf("celular") !== -1 || id.indexOf("mobile") !== -1) {
        applyMask(el, "(##) #####-####");
      } else if (ph === "(00) 0000-0000" || id.indexOf("phone") !== -1 || id.indexOf("fixo") !== -1 || id === "telefonefixo") {
        applyMask(el, "(##) ####-####");
      } else if (ph === "00000-000" || id.indexOf("cep") !== -1 || id === "zip") {
        applyMask(el, "#####-###");
        setupCepLookup(el);
      } else if (ph.toUpperCase() === "DD/MM/AAAA" || id.indexOf("birth") !== -1 || id.indexOf("nasc") !== -1) {
        applyMask(el, "##/##/####");
      }
    });
  }

  // ===== Custom dropdown panel =====
  function setupDropdown(dd) {
    if (dd.dataset.customDdSetup) return;
    dd.dataset.customDdSetup = "1";

    var id = dd.id;
    var opts = OPTIONS[id] || [];
    if (opts.length === 0) return;

    dd.style.cursor = "pointer";

    dd.addEventListener("click", function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      // Fecha qualquer outro painel aberto
      document.querySelectorAll(".__custom-dd-panel").forEach(function (p) { p.remove(); });

      // Garante que o dd tenha position relative pro painel absoluto funcionar
      var ddPos = window.getComputedStyle(dd).position;
      if (ddPos === "static") {
        dd.style.position = "relative";
      }

      var panel = document.createElement("div");
      panel.className = "__custom-dd-panel";
      panel.style.cssText =
        "position:absolute;z-index:99999;background:#fff;border:1px solid #cbd5e1;" +
        "border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.12);" +
        "left:0;right:0;top:calc(100% + 4px);max-height:280px;overflow-y:auto;" +
        "font-family:inherit;font-size:14px;";

      opts.forEach(function (o) {
        var item = document.createElement("div");
        item.textContent = o;
        item.style.cssText = "padding:10px 14px;cursor:pointer;color:#334155;";
        item.addEventListener("mouseenter", function () { item.style.background = "#f1f5f9"; });
        item.addEventListener("mouseleave", function () { item.style.background = ""; });
        item.addEventListener("click", function (e) {
          e.stopPropagation();
          var label = dd.querySelector(".p-dropdown-label");
          if (label) {
            label.textContent = o;
            label.classList.remove("p-placeholder");
            label.style.color = "#0f172a";
          }
          var sel = dd.querySelector("select");
          if (sel) {
            Array.from(sel.options).forEach(function (op) { op.selected = false; });
            var found = Array.from(sel.options).find(function (op) { return op.text === o; });
            if (!found) {
              found = document.createElement("option");
              found.text = o;
              found.value = o;
              sel.appendChild(found);
            }
            found.selected = true;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
          panel.remove();
        });
        panel.appendChild(item);
      });

      // Adiciona o painel DENTRO do dropdown (assim segue o scroll/transform corretamente)
      dd.appendChild(panel);

      // Fecha ao clicar fora
      setTimeout(function () {
        function closeOnOutside(e) {
          if (!panel.contains(e.target) && !dd.contains(e.target)) {
            panel.remove();
            document.removeEventListener("click", closeOnOutside, true);
          }
        }
        document.addEventListener("click", closeOnOutside, true);
      }, 0);
    });
  }

  function setupAllDropdowns() {
    Object.keys(OPTIONS).forEach(function (id) {
      var dd = document.getElementById(id);
      if (dd) setupDropdown(dd);
    });
  }

  // ===== Busca automática de CEP via ViaCEP =====
  function findFieldByLabel(text) {
    // Procura um campo de input cujo label/texto adjacente contenha "text"
    var labels = document.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      var lt = (labels[i].textContent || "").toLowerCase().trim();
      if (lt.indexOf(text.toLowerCase()) !== -1) {
        // Busca input/dropdown próximo
        var input = labels[i].nextElementSibling;
        while (input) {
          var inp = input.tagName === "INPUT" ? input : input.querySelector("input, .p-dropdown");
          if (inp) return inp;
          input = input.nextElementSibling;
        }
        // ou irmão dentro do mesmo container
        var parent = labels[i].parentElement;
        if (parent) {
          var inp2 = parent.querySelector("input:not([readonly]), .p-dropdown");
          if (inp2) return inp2;
        }
      }
    }
    return null;
  }

  function setFieldValue(field, value) {
    if (!field) return;
    if (field.tagName === "INPUT") {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (field.classList && field.classList.contains("p-dropdown")) {
      // É um dropdown - atualiza o label e select interno
      var label = field.querySelector(".p-dropdown-label");
      if (label) {
        label.textContent = value;
        label.classList.remove("p-placeholder");
        label.style.color = "#0f172a";
      }
      var sel = field.querySelector("select");
      if (sel) {
        Array.from(sel.options).forEach(function (op) { op.selected = false; });
        var found = Array.from(sel.options).find(function (op) { return op.text === value; });
        if (!found) {
          found = document.createElement("option");
          found.text = value;
          found.value = value;
          sel.appendChild(found);
        }
        found.selected = true;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function setupCepLookup(cepEl) {
    if (cepEl.dataset.cepLookup) return;
    cepEl.dataset.cepLookup = "1";

    var lastFetched = "";

    function lookup() {
      var raw = cepEl.value.replace(/\D/g, "");
      if (raw.length !== 8) return;
      if (raw === lastFetched) return;
      lastFetched = raw;

      cepEl.style.borderColor = "";
      cepEl.title = "";
      var orig = cepEl.style.background;
      cepEl.style.background = "#f1f5f9";

      fetch("https://viacep.com.br/ws/" + raw + "/json/")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          cepEl.style.background = orig;
          if (data.erro) {
            cepEl.style.borderColor = "#e24c4c";
            cepEl.title = "CEP não encontrado";
            return;
          }
          // Preenche os campos pelos IDs do formulário
          var street = document.getElementById("street");
          var neighborhood = document.getElementById("neighborhood");
          var city = document.getElementById("city");
          var ufDd = document.getElementById("state");

          if (street && data.logradouro) {
            street.value = data.logradouro;
            street.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (neighborhood && data.bairro) {
            neighborhood.value = data.bairro;
            neighborhood.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (city && data.localidade) {
            city.value = data.localidade;
            city.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (ufDd && data.uf) {
            setFieldValue(ufDd, data.uf);
          }
        })
        .catch(function () {
          cepEl.style.background = orig;
        });
    }

    cepEl.addEventListener("input", function () {
      var raw = cepEl.value.replace(/\D/g, "");
      if (raw.length === 8) {
        lookup();
      } else {
        lastFetched = "";
      }
    });
    cepEl.addEventListener("blur", lookup);
  }

  function init() {
    unlockInputs();
    applyMasks();
    setupAllDropdowns();
    setupSubmitButton();
  }

  // ===== Validação de campos obrigatórios + Botão Salvar e Continuar =====
  function getConcursoFromUrl() {
    try {
      var url = new URL(window.top.location.href);
      var c = url.searchParams.get("concurso");
      if (c && ["saude", "cajari", "educacao", "guarda"].indexOf(c) !== -1) return c;
    } catch (e) {}
    return "saude"; // default
  }

  function findSubmitButton() {
    var all = document.querySelectorAll("button");
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || "").trim();
      var aria = all[i].getAttribute("aria-label") || "";
      if (/salvar.*continuar/i.test(t) || /salvar.*continuar/i.test(aria)) {
        return all[i];
      }
    }
    return null;
  }

  function setupSubmitButton() {
    var REQUIRED_INPUTS = [
      "fullName", "cpf", "rg", "issuingBody",
      "motherName", "email", "phone",
      "zipCode", "street", "number", "neighborhood", "city",
    ];
    var REQUIRED_DROPDOWNS = ["maritalStatus", "gender", "state"];

    function validate() {
      var allValid = true;
      // inputs por id
      for (var i = 0; i < REQUIRED_INPUTS.length; i++) {
        var el = document.getElementById(REQUIRED_INPUTS[i]);
        if (!el || !el.value || !el.value.trim()) {
          allValid = false;
          break;
        }
      }
      // dropdowns
      if (allValid) {
        for (var j = 0; j < REQUIRED_DROPDOWNS.length; j++) {
          var dd = document.getElementById(REQUIRED_DROPDOWNS[j]);
          if (!dd) { allValid = false; break; }
          var lbl = dd.querySelector(".p-dropdown-label");
          if (!lbl || lbl.classList.contains("p-placeholder") || (lbl.textContent || "").trim() === "Selecione" || !(lbl.textContent || "").trim()) {
            allValid = false;
            break;
          }
        }
      }
      // Data Nascimento (placeholder DD/MM/AAAA)
      if (allValid) {
        var birth = document.querySelector('input[placeholder="DD/MM/AAAA"]');
        if (!birth || birth.value.replace(/\D/g, "").length !== 8) {
          allValid = false;
        }
      }

      // CPF válido
      if (allValid) {
        var cpfEl = document.getElementById("cpf");
        if (cpfEl && !validaCPF(cpfEl.value)) allValid = false;
      }

      var btn = findSubmitButton();
      if (btn) {
        if (allValid) {
          btn.disabled = false;
          btn.removeAttribute("disabled");
          btn.classList.remove("p-disabled");
          btn.style.opacity = "";
          btn.style.cursor = "pointer";
        } else {
          btn.disabled = true;
          btn.setAttribute("disabled", "");
          btn.classList.add("p-disabled");
          btn.style.cursor = "not-allowed";
        }
      }
      return allValid;
    }

    // Escuta todos inputs
    document.querySelectorAll("input").forEach(function (el) {
      if (el.dataset.valSetup) return;
      el.dataset.valSetup = "1";
      el.addEventListener("input", validate);
      el.addEventListener("change", validate);
      el.addEventListener("blur", validate);
    });
    // Escuta selects internos dos dropdowns
    REQUIRED_DROPDOWNS.forEach(function (id) {
      var dd = document.getElementById(id);
      if (!dd) return;
      var sel = dd.querySelector("select");
      if (sel && !sel.dataset.valSetup) {
        sel.dataset.valSetup = "1";
        sel.addEventListener("change", validate);
      }
    });

    // Liga clique do botão pra navegar
    var btn = findSubmitButton();
    if (btn && !btn.dataset.navSetup) {
      btn.dataset.navSetup = "1";
      btn.addEventListener("click", function (e) {
        if (!validate()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        var concurso = getConcursoFromUrl();
        window.top.location.href = "/cargo/" + concurso;
      }, true);
    }

    validate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(init, 3000);
})();
