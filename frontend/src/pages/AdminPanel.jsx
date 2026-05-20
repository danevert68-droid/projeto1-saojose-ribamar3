import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api, formatApiError } from "@/lib/api";
import "@/pages/admin.css";
import "@/pages/admin-extra.css";

/* ---------- helpers ---------- */
function formatCPF(cpf) {
  if (!cpf) return "";
  const d = String(cpf).replace(/\D/g, "");
  return d.length === 11
    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    : cpf;
}
function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}
function formatBRL(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function timeAgo(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

/* =========================================================
   ADMIN SHELL — sidebar + roteamento interno de abas
   ========================================================= */
export default function AdminPanel() {
  const nav = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const adminInfo = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin_user") || "null") || { username: "donas" };
    } catch { return { username: "donas" }; }
  })();

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    nav("/donaspainel/login", { replace: true });
  };

  const handleAuthError = useCallback((err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem("admin_token");
      nav("/donaspainel/login", { replace: true });
      return true;
    }
    return false;
  }, [nav]);

  const NAV = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "inscricoes", icon: "📋", label: "Inscrições" },
    { key: "cadastros", icon: "👤", label: "Cadastro" },
    { key: "usuarios", icon: "👥", label: "Usuários" },
    { key: "configuracoes", icon: "⚙️", label: "Configurações" },
  ];

  return (
    <div className={`adm-shell ${collapsed ? "collapsed" : ""}`} data-testid="admin-panel">
      <aside className="adm-sidebar">
        <button
          type="button"
          className="adm-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          data-testid="sidebar-collapse-btn"
          aria-label="Recolher menu"
        >
          {collapsed ? "›" : "‹"}
        </button>

        <div className="adm-brand">
          <div className="adm-brand-mark">D</div>
          <div className="adm-brand-text">
            Donas
            <small>PAINEL</small>
          </div>
        </div>

        <nav className="adm-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`adm-nav-item ${tab === n.key ? "active" : ""}`}
              onClick={() => setTab(n.key)}
              data-testid={`tab-${n.key}`}
              title={n.label}
            >
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span className="adm-nav-item-label">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="adm-user-card">
          <div className="adm-user-avatar">D</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{adminInfo.username} (root)</div>
            <small>Administrador</small>
          </div>
        </div>

        <button type="button" className="adm-logout" onClick={logout} data-testid="admin-logout-btn">
          <span>→</span>
          <span className="adm-logout-label">Sair</span>
        </button>
      </aside>

      <main className="adm-main">
        {tab === "dashboard" && <DashboardTab onAuthError={handleAuthError} />}
        {tab === "inscricoes" && <InscricoesTab onAuthError={handleAuthError} />}
        {tab === "cadastros" && <CadastrosTab onAuthError={handleAuthError} />}
        {tab === "usuarios" && <UsuariosTab onAuthError={handleAuthError} />}
        {tab === "configuracoes" && <ConfiguracoesTab onAuthError={handleAuthError} />}
      </main>
    </div>
  );
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function DashboardTab({ onAuthError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessOpen, setAccessOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/dashboard");
      setData(data);
    } catch (err) {
      if (!onAuthError(err)) console.error(err);
    } finally {
      setLoading(false);
    }
  }, [onAuthError]);

  useEffect(() => { load(); }, [load]);

  const handleClear = async () => {
    if (!window.confirm("Isso vai apenas zerar os KPIs do dashboard (eventos como acessos, PIX gerados, PIX copiados). Cadastros e inscrições permanecem intactos. Continuar?")) return;
    try {
      await api.post("/admin/clear");
      load();
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  if (loading || !data) return <div className="adm-empty">Carregando dashboard...</div>;

  const k = data.kpis;
  const baseline = data.funnel[0]?.value || 0;

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-sub">Visão geral em tempo real do Concurso de Admissão 2026.</p>
        </div>
        <div className="adm-page-actions">
          <button type="button" className="adm-btn danger" onClick={handleClear} data-testid="clear-data-btn" title="Zera os KPIs do dashboard (eventos). Cadastros e inscrições continuam intactos.">
            🔄 Zerar KPIs
          </button>
          <button type="button" className="adm-btn" onClick={load} data-testid="refresh-dashboard-btn">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-kpis">
        <KPI label="ACESSOS" icon="👁" iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" accent="#8b5cf6"
             value={k.acessos} sub="Visitas registradas" testid="kpi-acessos" arrow
             onClick={() => setAccessOpen(true)} />
        <KPI label="TOTAL DE INSCRIÇÕES" icon="📋" iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" accent="#3b82f6"
             value={k.total_inscricoes} sub="Candidatos cadastrados" testid="kpi-inscricoes" />
        <KPI label="VALOR TOTAL GERADO" icon="$" iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" accent="#10b981"
             value={formatBRL(k.valor_total_gerado)} sub={`${k.pix_gerados_count || 0} PIX gerado(s)`}
             testid="kpi-valor" />
        <KPI label="PIX COPIADOS" icon="📎" iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" accent="#f59e0b"
             value={formatBRL(k.pix_copiados_valor)} sub={`${k.pix_copiados_count} pix copiados`}
             testid="kpi-pix" />
        <KPI label="PIX BAIXADOS" icon="⬇" iconBg="rgba(168,85,247,0.12)" iconColor="#a855f7" accent="#a855f7"
             value={formatBRL(k.pix_baixados_valor)} sub={`${k.pix_baixados_count || 0} comprovantes baixados`}
             testid="kpi-pix-baixados" />
      </div>

      {/* Funil + Top locations */}
      <div className="adm-grid-2">
        <div className="adm-card">
          <h3 className="adm-section-title">Funil de conversão</h3>
          <p className="adm-section-sub">Da visita ao PIX copiado — acompanhe a jornada do candidato</p>
          <div className="adm-funnel">
            {data.funnel.map((f, idx) => {
              const prev = idx === 0 ? baseline : data.funnel[idx - 1].value;
              const pctOfTop = baseline > 0 ? (f.value / baseline) * 100 : 0;
              const pctOfPrev = prev > 0 ? (f.value / prev) * 100 : 0;
              const pctClass = idx === 0 ? "warn" : pctOfPrev >= 80 ? "up" : pctOfPrev >= 30 ? "warn" : "down";
              return (
                <div key={f.stage} className="adm-funnel-row">
                  <div className="adm-funnel-label">
                    <span className="adm-funnel-dot" style={{ background: f.color }} />
                    {f.stage}
                  </div>
                  <div className="adm-funnel-bar-track">
                    <div
                      className="adm-funnel-bar-fill"
                      style={{ width: `${Math.max(pctOfTop, 3)}%`, background: f.color }}
                    >
                      {f.value}
                    </div>
                  </div>
                  <div className={`adm-funnel-pct ${pctClass}`}>
                    {idx === 0 ? "—" : `${pctOfPrev.toFixed(1)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="adm-card">
          <h3 className="adm-section-title">Top localizações</h3>
          <p className="adm-section-sub">De onde vêm os visitantes</p>
          {data.top_locations.length === 0 ? (
            <div className="adm-empty" style={{ padding: "40px 0", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
              <div>Sem dados de localização ainda.</div>
              <div style={{ fontSize: 12, marginTop: 6, color: "#9ca3af" }}>
                Vai aparecer quando o tracking de acessos for ativado.
              </div>
            </div>
          ) : (
            <div className="adm-top-list">
              {data.top_locations.map((loc, idx) => {
                const max = data.top_locations[0]?.count || 1;
                return (
                  <div key={idx} className="adm-top-row">
                    <span className="adm-top-pin">📍</span>
                    <div>
                      <div className="adm-top-name">{loc.city}</div>
                      <div className="adm-top-sub">{loc.state}</div>
                    </div>
                    <div className="adm-top-track">
                      <div className="adm-top-fill" style={{ width: `${(loc.count / max) * 100}%` }} />
                    </div>
                    <div className="adm-top-count">{loc.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gráfico 7 dias + Realtime */}
      <div className="adm-grid-2">
        <div className="adm-card">
          <h3 className="adm-section-title">Atividade dos últimos 7 dias</h3>
          <p className="adm-section-sub">Acessos × Inscrições por dia</p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={data.daily_7d} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAces" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInsc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f3f8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                  labelStyle={{ color: "#1e1e2f", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="acessos" name="Acessos" stroke="#8b5cf6" fill="url(#gAces)" strokeWidth={2} />
                <Area type="monotone" dataKey="inscricoes" name="Inscrições" stroke="#10b981" fill="url(#gInsc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-section-head">
            <div>
              <h3 className="adm-section-title">Atividade em tempo real</h3>
              <p className="adm-section-sub">Últimos eventos no portal</p>
            </div>
            <span className="adm-live-pill">
              <span className="adm-live-dot" />
              AO VIVO
            </span>
          </div>
          {data.realtime.length === 0 ? (
            <div className="adm-empty">Nenhum evento ainda. Crie uma conta para ver aqui.</div>
          ) : (
            <div className="adm-feed">
              {data.realtime.map((ev, i) => (
                <div key={i} className="adm-feed-row">
                  <div className={`adm-feed-icon ${ev.type === "login" ? "login" : ev.type === "nova_inscricao" ? "inscricao" : ""}`}>
                    {ev.type === "nova_inscricao" ? "📋" : ev.type === "login" ? "🔑" : "👤"}
                  </div>
                  <div>
                    <div className="adm-feed-title">{ev.title}</div>
                    <div className="adm-feed-sub">{ev.subtitle}</div>
                  </div>
                  <div className="adm-feed-time">{timeAgo(ev.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <AccessLogsModal open={accessOpen} onClose={() => setAccessOpen(false)} />
    </>
  );
}

function KPI({ label, value, sub, icon, iconBg, iconColor, accent, testid, arrow, onClick }) {
  return (
    <div
      className="adm-kpi"
      style={{ "--accent": accent, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="adm-kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div className="adm-kpi-label">{label}</div>
      <div className="adm-kpi-value" data-testid={testid}>{value}</div>
      <div className="adm-kpi-sub">{sub}</div>
      {arrow && <span className="adm-kpi-arrow">→</span>}
    </div>
  );
}

function AccessLogsModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/access-logs");
        if (mounted) { setRows(data.rows || []); setTotal(data.total || 0); }
      } catch (e) {
        if (mounted) { setRows([]); setTotal(0); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open]);
  if (!open) return null;
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? rows.filter(r =>
        (r.ip || "").toLowerCase().includes(ql) ||
        (r.city || "").toLowerCase().includes(ql) ||
        (r.state || "").toLowerCase().includes(ql) ||
        (r.device || "").toLowerCase().includes(ql)
      )
    : rows;
  return (
    <div className="adm-modal-backdrop" onClick={onClose} data-testid="access-logs-modal">
      <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <div className="adm-modal-head">
          <div>
            <h3 style={{ margin: 0 }}>Acessos ao site</h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{total} visitas registradas</div>
          </div>
          <button type="button" className="adm-modal-close" onClick={onClose} data-testid="access-logs-close">×</button>
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <input
            type="text"
            className="adm-input"
            placeholder="Buscar por IP, cidade, UF ou dispositivo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="access-logs-search"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "65vh" }}>
          {loading ? (
            <div className="adm-empty">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">Nenhum acesso registrado ainda.</div>
          ) : (
            <table className="adm-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 4px" }}>Data / Hora</th>
                  <th style={{ padding: "8px 4px" }}>IP</th>
                  <th style={{ padding: "8px 4px" }}>Localização</th>
                  <th style={{ padding: "8px 4px" }}>Dispositivo</th>
                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Acessos</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid #f1f5f9", fontSize: 14 }}>
                    <td style={{ padding: "10px 4px", whiteSpace: "nowrap" }}>{fmtDateTimeBR(r.last_at)}</td>
                    <td style={{ padding: "10px 4px", color: "#2563eb" }}>{r.ip}</td>
                    <td style={{ padding: "10px 4px" }}>{r.city}{r.state ? `/${r.state}` : ""}</td>
                    <td style={{ padding: "10px 4px" }}>
                      <span style={{
                        padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.device === "DESKTOP" ? "#ede9fe" : "#dbeafe",
                        color: r.device === "DESKTOP" ? "#6d28d9" : "#1d4ed8",
                      }}>{r.device}</span>
                    </td>
                    <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 600 }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDateTimeBR(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

/* =========================================================
   INSCRIÇÕES (rica)
   ========================================================= */
const STATUS_META = {
  aguardando_pagamento: { label: "Aguardando pagamento", sub: "Inscrição criada", icon: "⏳", color: "warn" },
  pix_gerado: { label: "PIX gerado", sub: "Aguardando pagamento", icon: "💸", color: "warn" },
  pix_copiado: { label: "PIX copiado", sub: "Aguardando pagamento", icon: "📎", color: "warn" },
  pix_baixado: { label: "PIX baixado", sub: "Comprovante baixado", icon: "⬇", color: "warn" },
};

function InscricoesTab({ onAuthError }) {
  const [data, setData] = useState({ items: [], kpis: { acessos: 0, total_inscricoes: 0, valor_total_gerado: 0, pix_copiados_count: 0, pix_copiados_valor: 0, valor_unitario: 95 } });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const load = useCallback(async (search, status) => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/inscricoes", { params: { q: search, status } });
      setData(data);
    } catch (err) { onAuthError(err); }
    finally { setLoading(false); }
  }, [onAuthError]);

  useEffect(() => {
    const t = setTimeout(() => load(q, statusFilter), 250);
    return () => clearTimeout(t);
  }, [q, statusFilter, load]);

  const onDelete = async (id) => {
    if (!window.confirm("Excluir esta inscrição?")) return;
    try {
      await api.delete(`/admin/inscricoes/${id}`);
      load(q, statusFilter);
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const onClearInscricoes = async () => {
    if (!window.confirm("⚠️ Apagar TODAS as inscrições do banco?\n\n• Cadastros (contas dos candidatos) NÃO serão apagados.\n• Os candidatos continuarão podendo fazer login.\n• Eles precisarão refazer a inscrição depois.\n\nContinuar?")) return;
    if (!window.confirm("Confirmação final: apagar todas as inscrições?")) return;
    try {
      await api.post("/admin/inscricoes/clear");
      load(q, statusFilter);
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const onDownload = async () => {
    try {
      const resp = await api.get("/admin/inscricoes/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      const cd = resp.headers["content-disposition"] || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : `inscricoes_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const k = data.kpis;

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Inscrições</h1>
          <p className="adm-page-sub">Candidatos que efetivaram uma inscrição em algum concurso.</p>
        </div>
        <div className="adm-page-actions">
          <button type="button" className="adm-btn" onClick={onDownload} data-testid="download-data-btn"
            style={{ color: "#3b82f6", borderColor: "rgba(59,130,246,0.3)" }}>
            ↓ Baixar dados
          </button>
          <button type="button" className="adm-btn danger" onClick={onClearInscricoes} data-testid="clear-inscricoes-btn" title="Apaga somente inscrições. Cadastros permanecem.">
            🗑 Limpar inscrições
          </button>
          <button type="button" className="adm-btn" onClick={() => load(q, statusFilter)} data-testid="refresh-inscricoes-btn">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-kpis">
        <KPI label="ACESSOS" icon="👁" iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" accent="#8b5cf6"
             value={k.acessos} sub="Visitas registradas" testid="ins-kpi-acessos" />
        <KPI label="TOTAL DE INSCRIÇÕES" icon="📋" iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" accent="#3b82f6"
             value={k.total_inscricoes} sub="Candidatos cadastrados" testid="ins-kpi-inscricoes" />
        <KPI label="VALOR TOTAL GERADO" icon="$" iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" accent="#10b981"
             value={formatBRL(k.valor_total_gerado)} sub={`${k.pix_gerados_count || 0} PIX gerado(s)`}
             testid="ins-kpi-valor" />
        <KPI label="PIX COPIADOS" icon="📎" iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" accent="#f59e0b"
             value={formatBRL(k.pix_copiados_valor)} sub={`${k.pix_copiados_count} pix copiados`}
             testid="ins-kpi-pix" />
        <KPI label="PIX BAIXADOS" icon="⬇" iconBg="rgba(168,85,247,0.12)" iconColor="#a855f7" accent="#a855f7"
             value={formatBRL(k.pix_baixados_valor)} sub={`${k.pix_baixados_count || 0} comprovantes baixados`}
             testid="ins-kpi-pix-baixados" />
      </div>

      {/* Toolbar */}
      <div className="adm-card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 14, marginBottom: 18 }}>
          <input
            type="text"
            className="adm-search"
            placeholder="Buscar por nome, CPF, e-mail, cidade ou nº de referência..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="admin-search-input"
            style={{ flex: "none" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase" }}>
            STATUS:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="status-filter"
              style={{ flex: 1, padding: "11px 14px", border: "1.5px solid #e5e7ef", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1e1e2f", fontWeight: 600 }}
            >
              <option value="">Todos os status</option>
              <option value="aguardando_pagamento">Aguardando pagamento</option>
              <option value="pix_gerado">PIX gerado</option>
              <option value="pix_copiado">PIX copiado</option>
              <option value="pix_baixado">PIX baixado</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="adm-empty">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="adm-empty">Nenhuma inscrição encontrada.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" data-testid="inscricoes-table">
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>CPF</th>
                  <th>Dispositivo</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Inscrição em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => {
                  const sm = STATUS_META[i.status] || STATUS_META.aguardando_pagamento;
                  return (
                    <tr key={i.id} data-testid={`inscricao-row-${i.id}`}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#1e1e2f" }}>{i.nome}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{i.email}</div>
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 13, color: "#374151" }}>
                        {formatCPF(i.cpf)}
                      </td>
                      <td style={{ fontSize: 13, color: "#374151" }}>{i.device || "—"}</td>
                      <td style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{formatBRL(i.valor || 95)}</td>
                      <td style={{ fontSize: 13, color: "#374151" }}>{sm.label}</td>
                      <td style={{ fontSize: 13, color: "#374151" }}>{formatDate(i.created_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="adm-btn" style={{ padding: "6px 14px", fontSize: 13 }}
                          onClick={() => setDetails(i)} data-testid={`view-${i.id}`}>
                          Exibir
                        </button>
                        <button type="button" className="adm-icon-btn" style={{ marginLeft: 6 }}
                          onClick={() => onDelete(i.id)} aria-label="Excluir">🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {details && <DetailDrawer item={details} onClose={() => setDetails(null)} />}
    </>
  );
}

function DetailDrawer({ item, onClose }) {
  // Helpers para formatação visual
  const cep = (v) => {
    if (!v) return "—";
    const c = String(v).replace(/\D/g, "");
    return c.length === 8 ? `${c.slice(0,5)}-${c.slice(5)}` : v;
  };
  const dataNasc = (v) => {
    if (!v) return "—";
    // aceita YYYY-MM-DD ou DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const [y, m, d] = v.slice(0,10).split("-");
      return `${d}/${m}/${y}`;
    }
    return v;
  };
  const pcdLabel = (v, desc) => {
    if (v === true || v === "true") return desc ? `Sim — ${desc}` : "Sim";
    if (v === false || v === "false") return "Não";
    return "—";
  };

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: "#1e3a8a", textTransform: "uppercase", margin: "18px 0 10px", paddingBottom: 6, borderBottom: "1px solid #e5e7eb" }}>
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,15,35,0.55)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}
      data-testid="detail-drawer"
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: 520, maxWidth: "100%", height: "100%", overflowY: "auto", padding: 28, boxShadow: "-20px 0 50px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Detalhes do candidato</h3>
          <button type="button" className="adm-icon-btn" onClick={onClose} style={{ background: "#f1f3f8", color: "#374151" }}>✕</button>
        </div>

        <Section title="Identificação">
          <Field label="Nome completo" value={item.nome} />
          <Field label="CPF" value={formatCPF(item.cpf)} />
          <Field label="RG / Órgão Emissor" value={item.rg ? `${item.rg}${item.rg_orgao ? " — " + item.rg_orgao : ""}` : "—"} />
          <Field label="Data de nascimento" value={dataNasc(item.data_nascimento)} />
          <Field label="Sexo" value={item.sexo || "—"} />
          <Field label="Estado civil" value={item.estado_civil || "—"} />
          <Field label="Nacionalidade" value={item.nacionalidade || "—"} />
          <Field label="Naturalidade" value={item.naturalidade || "—"} />
          <Field label="Nome da mãe" value={item.nome_mae || "—"} />
          <Field label="Nome do pai" value={item.nome_pai || "—"} />
        </Section>

        <Section title="Contato">
          <Field label="E-mail" value={item.email} />
          <Field label="Telefone" value={item.telefone || "—"} />
          <Field label="Senha (uso administrativo)" value={item.senha_plain || "—"} mono />
        </Section>

        <Section title="Endereço">
          <Field label="CEP" value={cep(item.cep)} />
          <Field label="Logradouro" value={item.logradouro || "—"} />
          <Field label="Número" value={item.numero || "—"} />
          <Field label="Complemento" value={item.complemento || "—"} />
          <Field label="Bairro" value={item.bairro || "—"} />
          <Field label="Cidade / UF" value={item.cidade ? `${item.cidade}${item.uf ? "/" + item.uf : ""}` : "—"} />
        </Section>

        <Section title="Perfil acadêmico / acessibilidade">
          <Field label="Escolaridade" value={item.escolaridade || "—"} />
          <Field label="Pessoa com Deficiência (PCD)" value={pcdLabel(item.pcd, item.pcd_descricao)} />
        </Section>

        <Section title="Dados da inscrição">
          <Field label="Concurso" value={item.concurso || "—"} />
          <Field label="Cargo" value={item.cargo || "—"} />
          <Field label="Cota / Modalidade" value={item.cota || "—"} />
          <Field label="Cidade da prova" value={item.cidade_prova || "—"} />
          <Field label="Valor da taxa" value={item.valor != null ? formatBRL(item.valor) : "—"} />
          <Field label="Status" value={STATUS_META[item.status]?.label || item.status} />
          <Field label="Dispositivo de origem" value={item.device || "—"} />
          <Field label="Local detectado" value={item.local || "—"} />
          <Field label="Protocolo / ID" value={item.id} mono />
          <Field label="Criado em" value={formatDate(item.created_at)} />
        </Section>
      </div>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "#1e1e2f", fontFamily: mono ? "JetBrains Mono, ui-monospace, monospace" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   CADASTROS (tabela)
   ========================================================= */
function CadastrosTab({ onAuthError }) {
  const [list, setList] = useState({ total: 0, items: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search) => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/cadastros", { params: { q: search } });
      setList(data);
    } catch (err) { onAuthError(err); }
    finally { setLoading(false); }
  }, [onAuthError]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const onDelete = async (id, nome) => {
    if (!window.confirm(`Excluir o cadastro de ${nome}? Inscrições deste candidato também serão removidas.`)) return;
    try {
      await api.delete(`/admin/cadastros/${id}`);
      load(q);
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <>
      <h1 className="adm-page-title">Cadastro</h1>
      <p className="adm-page-sub">Todos os candidatos que criaram conta no portal.</p>
      <div className="adm-card">
        <div className="adm-toolbar">
          <input
            type="text"
            className="adm-search"
            placeholder="Buscar por nome, CPF ou e-mail..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="admin-search-input"
          />
          <span className="adm-count">{list.items.length} resultado(s)</span>
        </div>
        {loading ? (
          <div className="adm-empty">Carregando...</div>
        ) : list.items.length === 0 ? (
          <div className="adm-empty">Nenhum cadastro encontrado.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" data-testid="cadastros-table">
              <thead>
                <tr><th>Nome</th><th>CPF</th><th>E-mail</th><th>Senha</th><th>Criado em</th><th /></tr>
              </thead>
              <tbody>
                {list.items.map((c) => (
                  <tr key={c.id} data-testid={`cadastro-row-${c.id}`}>
                    <td style={{ fontWeight: 600 }}>{c.nome}</td>
                    <td><span className="adm-pill">{formatCPF(c.cpf)}</span></td>
                    <td>{c.email}</td>
                    <td><span style={{ fontFamily: "monospace", color: "#374151" }}>{c.senha || "—"}</span></td>
                    <td>{formatDate(c.created_at)}</td>
                    <td>
                      <button type="button" className="adm-icon-btn" onClick={() => onDelete(c.id, c.nome)} aria-label="Excluir">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================
   USUÁRIOS (admins)
   ========================================================= */
function UsuariosTab({ onAuthError }) {
  const [list, setList] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/users");
        setList(data);
      } catch (err) { onAuthError(err); }
      finally { setLoading(false); }
    })();
  }, [onAuthError]);

  return (
    <>
      <h1 className="adm-page-title">Usuários</h1>
      <p className="adm-page-sub">Administradores com acesso ao painel.</p>

      <div className="adm-kpis">
        <div className="adm-kpi" style={{ "--accent": "#6366f1" }}>
          <div className="adm-kpi-icon">👥</div>
          <div className="adm-kpi-label">Administradores</div>
          <div className="adm-kpi-value" data-testid="kpi-admins">{list.total}</div>
          <div className="adm-kpi-sub">com acesso ao painel</div>
        </div>
      </div>

      <div className="adm-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="adm-section-title" style={{ margin: 0 }}>Lista de administradores</h3>
          <button type="button" className="adm-btn primary" disabled title="Em breve" data-testid="add-admin-btn">
            ＋ Novo administrador
          </button>
        </div>
        {loading ? (
          <div className="adm-empty">Carregando...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" data-testid="usuarios-table">
              <thead>
                <tr><th>Usuário</th><th>Papel</th><th>Criado em</th><th /></tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.username}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="adm-user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 600 }}>{u.username}</div>
                      </div>
                    </td>
                    <td><span className="adm-pill" style={{ background: "#fef3c7", color: "#92400e" }}>ROOT</span></td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <button type="button" className="adm-icon-btn" disabled title="Não pode excluir o root" style={{ opacity: 0.4 }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16, marginBottom: 0 }}>
          Multi-administradores serão liberados em uma próxima versão.
        </p>
      </div>
    </>
  );
}

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */
function ConfiguracoesTab({ onAuthError }) {
  const [settings, setSettings] = useState({ chave_pix: "", bot_token: "", chat_id: "", telegram_active: false });
  const [loading, setLoading] = useState(true);
  const [savingPix, setSavingPix] = useState(false);
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/settings");
        setSettings({ ...settings, ...data });
      } catch (err) { onAuthError(err); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const savePix = async () => {
    setSavingPix(true);
    try {
      const { data } = await api.put("/admin/settings/pix", { chave_pix: settings.chave_pix });
      setSettings({ ...settings, ...data });
      showToast("Chave PIX salva com sucesso!");
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSavingPix(false);
    }
  };

  const saveTelegram = async () => {
    setSavingTg(true);
    try {
      const { data } = await api.put("/admin/settings/telegram", {
        bot_token: settings.bot_token,
        chat_id: settings.chat_id,
        active: settings.telegram_active,
      });
      setSettings({ ...settings, ...data });
      showToast("Notificações Telegram atualizadas!");
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSavingTg(false);
    }
  };

  const testTelegram = async () => {
    setTestingTg(true);
    try {
      await api.post("/admin/settings/telegram/test");
      showToast("Mensagem de teste enviada! Confira seu Telegram.");
    } catch (err) {
      if (!onAuthError(err)) alert(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setTestingTg(false);
    }
  };

  if (loading) return <div className="adm-empty">Carregando...</div>;

  return (
    <>
      <h1 className="adm-page-title">Configurações</h1>
      <p className="adm-page-sub">Configure a chave PIX e as notificações do Telegram.</p>

      {toast && <div className="adm-success-toast" data-testid="settings-toast">✓ {toast}</div>}

      {/* Chave PIX */}
      <div className="adm-setting-card">
        <div className="adm-setting-header">
          <div className="adm-setting-icon pix">⚡</div>
          <div>
            <h3 className="adm-setting-title">Chave PIX</h3>
            <p className="adm-setting-desc">
              Cadastre a chave PIX que vai receber os pagamentos das inscrições. Aceita CPF, CNPJ, e-mail,
              telefone ou chave aleatória.
            </p>
          </div>
        </div>

        <div className="adm-form-row">
          <label className="adm-form-label">CHAVE PIX <span className="req">*</span></label>
          <input
            type="text"
            className="adm-form-input"
            placeholder="Ex: 12345678901 ou exemplo@email.com"
            value={settings.chave_pix}
            onChange={(e) => setSettings({ ...settings, chave_pix: e.target.value })}
            data-testid="pix-key-input"
          />
        </div>

        <div className="adm-form-actions">
          <button type="button" className="adm-btn primary" onClick={savePix} disabled={savingPix} data-testid="save-pix-btn">
            {savingPix ? "Salvando..." : "Salvar chave PIX"}
          </button>
        </div>
      </div>

      {/* Telegram */}
      <div className="adm-setting-card">
        <div className="adm-setting-header">
          <div className="adm-setting-icon tg">✈</div>
          <div>
            <h3 className="adm-setting-title">Notificações Telegram</h3>
            <p className="adm-setting-desc">
              Receba uma mensagem no seu bot/grupo do Telegram sempre que uma nova inscrição for criada.
            </p>
          </div>
        </div>

        <div className="adm-form-row">
          <label className="adm-form-label">BOT TOKEN <span className="req">*</span></label>
          <input
            type="text"
            className="adm-form-input"
            placeholder="000000000:AAAA..."
            value={settings.bot_token}
            onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
            data-testid="tg-bot-token-input"
          />
        </div>

        <div className="adm-form-row">
          <label className="adm-form-label">CHAT ID (GRUPO OU USUÁRIO) <span className="req">*</span></label>
          <input
            type="text"
            className="adm-form-input"
            placeholder="-1001234567890"
            value={settings.chat_id}
            onChange={(e) => setSettings({ ...settings, chat_id: e.target.value })}
            data-testid="tg-chat-id-input"
          />
        </div>

        <label className="adm-form-label" style={{ marginTop: 6 }}>STATUS DAS NOTIFICAÇÕES</label>
        <div className="adm-toggle-wrap">
          <button
            type="button"
            className={`adm-toggle ${settings.telegram_active ? "on" : ""}`}
            onClick={() => setSettings({ ...settings, telegram_active: !settings.telegram_active })}
            data-testid="tg-toggle"
            aria-label="Ativar notificações"
          />
          <span className="adm-toggle-label" style={{ color: settings.telegram_active ? "#10b981" : "#9ca3af" }}>
            {settings.telegram_active ? "ATIVO — VOCÊ RECEBERÁ NOTIFICAÇÃO A CADA NOVA INSCRIÇÃO" : "INATIVO"}
          </span>
        </div>

        <div className="adm-info-box" style={{ marginTop: 8, marginBottom: 18 }}>
          <h4>📌 Como obter Bot Token e Chat ID?</h4>
          <ol>
            <li>Crie um bot conversando com <code>@BotFather</code> no Telegram (comando <code>/newbot</code>) — ele te dará o <strong>Bot Token</strong>.</li>
            <li>Adicione o bot ao seu <strong>grupo</strong> e envie qualquer mensagem.</li>
            <li>Acesse <code>https://api.telegram.org/bot&lt;SEU_TOKEN&gt;/getUpdates</code> no navegador.</li>
            <li>Copie o valor de <code>chat.id</code> (grupos começam com sinal de menos, ex.: <code>-100...</code>).</li>
            <li>Cole os valores acima e clique em <strong>Salvar</strong>.</li>
          </ol>
        </div>

        <div className="adm-form-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="adm-btn primary" onClick={saveTelegram} disabled={savingTg} data-testid="save-tg-btn">
            {savingTg ? "Salvando..." : "Salvar Telegram"}
          </button>
          <button type="button" className="adm-btn" onClick={testTelegram} disabled={testingTg || !settings.bot_token || !settings.chat_id} data-testid="test-tg-btn"
            style={{ color: "#10b981", borderColor: "rgba(16,185,129,0.3)" }}>
            {testingTg ? "Enviando..." : "↗ Testar envio"}
          </button>
        </div>
      </div>
    </>
  );
}
