import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import "@/pages/auth.css";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, senha });
      login(data.token, data.user);
      nav("/inscricao", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split" data-testid="login-page">
      <div className="auth-left">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-logo">
            <div className="auth-logo-mark">IJ</div>
            <div className="auth-logo-text">
              Instituto JKMA
              <small>SISTEMA DE INSCRIÇÕES</small>
            </div>
          </div>

          <h1 className="auth-title">{greeting()}, concurseiro!</h1>
          <p className="auth-subtitle">Acesse sua conta para continuar.</p>

          {error && <div className="auth-error" data-testid="login-error">{error}</div>}

          <div className="auth-field">
            <label className="auth-label">CPF ou E-mail</label>
            <input
              data-testid="login-identifier-input"
              type="text"
              className="auth-input"
              placeholder="000.000.000-00 ou seu@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Senha</label>
            <input
              data-testid="login-password-input"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="auth-row">
            <span />
            <button type="button" className="auth-link" data-testid="forgot-password-btn">
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
            data-testid="login-submit-btn"
          >
            {loading ? <span className="auth-spinner" /> : null}
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            className="auth-btn-secondary"
            onClick={() => nav("/home")}
            data-testid="see-contests-btn"
          >
            Ver concursos abertos
          </button>

          <div className="auth-footer">
            Não tem uma conta?{" "}
            <Link to="/signup" className="auth-link" data-testid="goto-signup-link">
              Criar conta gratuita
            </Link>
          </div>
        </form>
      </div>

      <div className="auth-right">
        <div className="auth-right-content">
          <h2>Concurso Público de São José de Ribamar</h2>
          <p>
            Acesse sua área do candidato para acompanhar inscrições, cargos e cotas
            dos 4 concursos abertos da Prefeitura.
          </p>
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-num">4</span>
              <span className="auth-stat-label">Concursos</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">38</span>
              <span className="auth-stat-label">Cargos</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">1.304</span>
              <span className="auth-stat-label">Vagas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
