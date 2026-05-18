import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import "@/pages/auth.css";

function maskCPF(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function maskTel(value) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 && ") ", b, c && `-${c}`].filter(Boolean).join("")
    );
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

export default function Signup() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    senha: "",
    senha2: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "cpf") v = maskCPF(v);
    if (k === "telefone") v = maskTel(v);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.senha !== form.senha2) {
      setError("As senhas não coincidem.");
      return;
    }
    if (form.senha.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        nome: form.nome,
        cpf: form.cpf,
        email: form.email,
        telefone: form.telefone,
        senha: form.senha,
      });
      login(data.token, data.user);
      nav("/inscricao", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split" data-testid="signup-page">
      <div className="auth-left">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-logo">
            <div className="auth-logo-mark">IJ</div>
            <div className="auth-logo-text">
              Instituto JKMA
              <small>SISTEMA DE INSCRIÇÕES</small>
            </div>
          </div>

          <h1 className="auth-title">Criar conta gratuita</h1>
          <p className="auth-subtitle">
            Preencha os dados abaixo. Leva menos de 1 minuto.
          </p>

          {error && <div className="auth-error" data-testid="signup-error">{error}</div>}

          <div className="auth-field">
            <label className="auth-label">Nome completo</label>
            <input
              data-testid="signup-nome-input"
              type="text"
              className="auth-input"
              placeholder="Seu nome completo"
              value={form.nome}
              onChange={onChange("nome")}
              required
              minLength={3}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">CPF</label>
            <input
              data-testid="signup-cpf-input"
              type="text"
              inputMode="numeric"
              className="auth-input"
              placeholder="000.000.000-00"
              value={form.cpf}
              onChange={onChange("cpf")}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">E-mail</label>
            <input
              data-testid="signup-email-input"
              type="email"
              className="auth-input"
              placeholder="seu@email.com"
              value={form.email}
              onChange={onChange("email")}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Telefone (opcional)</label>
            <input
              data-testid="signup-telefone-input"
              type="text"
              inputMode="numeric"
              className="auth-input"
              placeholder="(98) 99999-0000"
              value={form.telefone}
              onChange={onChange("telefone")}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Senha</label>
            <input
              data-testid="signup-password-input"
              type="password"
              className="auth-input"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={onChange("senha")}
              required
              minLength={6}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Confirmar senha</label>
            <input
              data-testid="signup-password2-input"
              type="password"
              className="auth-input"
              placeholder="Repita a senha"
              value={form.senha2}
              onChange={onChange("senha2")}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
            data-testid="signup-submit-btn"
          >
            {loading ? <span className="auth-spinner" /> : null}
            {loading ? "Criando conta..." : "Criar minha conta"}
          </button>

          <div className="auth-footer">
            Já tem uma conta?{" "}
            <Link to="/login" className="auth-link" data-testid="goto-login-link">
              Fazer login
            </Link>
          </div>
        </form>
      </div>

      <div className="auth-right">
        <div className="auth-right-content">
          <h2>Sua porta de entrada para o concurso público</h2>
          <p>
            Crie sua conta uma vez e gerencie todas as suas inscrições nos
            4 concursos abertos pela Prefeitura de São José de Ribamar.
          </p>
        </div>
      </div>
    </div>
  );
}
