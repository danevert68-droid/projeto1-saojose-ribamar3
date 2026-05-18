import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";

export default function AdminLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin/login", { username, senha });
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.admin));
      nav("/donaspainel", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="donas-login" data-testid="admin-login-page">
      <style>{styles}</style>

      {/* Left — hero with Donatello */}
      <aside className="donas-hero">
        <div
          className="donas-hero__bg"
          style={{ backgroundImage: "url(/admin/donatelo.jpg)" }}
          aria-hidden="true"
        />
        <div className="donas-hero__vignette" aria-hidden="true" />
        <div className="donas-hero__footer">
          <span className="donas-badge">
            <span className="donas-badge__dot" />
            Acesso restrito
          </span>
          <p className="donas-quote">
            O conhecimento é como uma escada: quanto mais alto você sobe,
            mais <span className="donas-quote__hl">ampla é sua visão</span>.
          </p>
        </div>
      </aside>

      {/* Right — login card */}
      <main className="donas-side">
        <form className="donas-card" onSubmit={submit} autoComplete="off">
          <div className="donas-brand">
            <div className="donas-brand__mark">D</div>
            <div className="donas-brand__text">
              <strong>Donas</strong>
              <small>PAINEL ADMINISTRATIVO</small>
            </div>
          </div>

          <h1 className="donas-title">Acessar painel</h1>
          <p className="donas-sub">Digite suas credenciais para continuar.</p>

          {error && (
            <div className="donas-error" data-testid="admin-login-error">
              {error}
            </div>
          )}

          <div className="donas-field">
            <label className="donas-label">USUÁRIO</label>
            <input
              data-testid="admin-username-input"
              type="text"
              className="donas-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              required
              autoFocus
            />
          </div>

          <div className="donas-field">
            <label className="donas-label">SENHA</label>
            <div className="donas-input-wrap">
              <input
                data-testid="admin-password-input"
                type={showPwd ? "text" : "password"}
                className="donas-input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="donas-eye"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="donas-submit"
            disabled={loading}
            data-testid="admin-login-submit-btn"
          >
            {loading ? "Entrando..." : "Entrar →"}
          </button>

          <div className="donas-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
            </svg>
            <span>Conexão segura · Apenas administradores autorizados.</span>
          </div>
        </form>
      </main>
    </div>
  );
}

const styles = `
.donas-login {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #0a0a0f;
  color: #f5f5f7;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

.donas-hero {
  position: relative;
  overflow: hidden;
}
.donas-hero__bg {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: brightness(0.95) contrast(1.05);
}
.donas-hero__vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 50%, transparent 0%, rgba(10,10,15,0.35) 70%, rgba(10,10,15,0.85) 100%),
    linear-gradient(to right, transparent 60%, #0a0a0f 100%);
  pointer-events: none;
}
.donas-hero__footer {
  position: absolute;
  bottom: 36px;
  left: 36px;
  right: 36px;
  z-index: 2;
}
.donas-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(124,58,237,0.18);
  border: 1px solid rgba(167,139,250,0.45);
  color: #c4b5fd;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
}
.donas-badge__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #a78bfa;
  box-shadow: 0 0 10px #a78bfa;
  animation: donas-pulse 1.8s ease-in-out infinite;
}
@keyframes donas-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
.donas-quote {
  font-style: italic;
  margin: 14px 0 0;
  font-size: 15px;
  max-width: 460px;
  color: #cbd5e1;
  line-height: 1.55;
  font-family: 'Georgia', serif;
}
.donas-quote__hl {
  background: linear-gradient(90deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 600;
}

.donas-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: radial-gradient(circle at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 50%), #0a0a0f;
}

.donas-card {
  width: 100%;
  max-width: 400px;
  padding: 36px 32px;
  background: linear-gradient(180deg, rgba(30,27,75,0.55) 0%, rgba(15,15,25,0.7) 100%);
  border: 1px solid rgba(99,102,241,0.18);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02);
  backdrop-filter: blur(14px);
}

.donas-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.donas-brand__mark {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 20px; color: #fff;
  box-shadow: 0 4px 14px rgba(99,102,241,0.45);
}
.donas-brand__text {
  display: flex; flex-direction: column; line-height: 1.1;
}
.donas-brand__text strong { font-size: 15px; font-weight: 600; color: #f5f5f7; }
.donas-brand__text small { font-size: 10px; color: #94a3b8; letter-spacing: 0.12em; margin-top: 2px; }

.donas-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #fff;
  letter-spacing: -0.01em;
}
.donas-sub {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 24px;
}

.donas-field { margin-bottom: 16px; }
.donas-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.donas-input-wrap { position: relative; }
.donas-input {
  width: 100%;
  padding: 13px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: #ffffff;
  color: #0f172a;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}
.donas-input-wrap .donas-input { padding-right: 44px; }
.donas-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
}
.donas-eye {
  position: absolute;
  right: 12px; top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  display: flex; align-items: center; justify-content: center;
}
.donas-eye:hover { color: #1e3a8a; }

.donas-error {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 16px;
}

.donas-submit {
  width: 100%;
  margin-top: 8px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(90deg, #6366f1 0%, #3b82f6 100%);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(99,102,241,0.35);
  transition: transform 0.1s, box-shadow 0.15s, opacity 0.15s;
  letter-spacing: 0.02em;
}
.donas-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(99,102,241,0.5);
}
.donas-submit:disabled { opacity: 0.7; cursor: not-allowed; }

.donas-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  font-size: 12px;
  color: #818cf8;
}

@media (max-width: 880px) {
  .donas-login { grid-template-columns: 1fr; }
  .donas-hero { display: none; }
  .donas-side { padding: 24px; }
}
`;
