import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CandidateRoute, AdminRoute } from "@/components/ProtectedRoute";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";

// Versão para invalidar cache quando atualizamos arquivos HTML
const PAGE_VERSION = "v74";

// Componente reutilizável para carregar páginas estáticas via iframe
const StaticPage = ({ src, title }) => (
  <iframe
    data-testid={`static-page-${title}`}
    src={`${src}?${PAGE_VERSION}`}
    title={title}
    style={{
      width: "100vw",
      height: "100vh",
      border: "none",
      display: "block",
      margin: 0,
      padding: 0,
    }}
  />
);

function App() {
  return (
    <div className="App" data-testid="app-root">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Público */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<StaticPage src="/pages/home.html" title="home" />} />
            <Route path="/saude" element={<StaticPage src="/pages/saude.html" title="saude" />} />
            <Route path="/guarda" element={<StaticPage src="/pages/guarda.html" title="guarda" />} />

            {/* Auth do candidato — páginas estáticas (design do site original) */}
            <Route path="/login" element={<StaticPage src="/pages/login.html" title="login" />} />
            <Route path="/signup" element={<StaticPage src="/pages/signup.html" title="signup" />} />

            {/* Lista pública de concursos abertos — qualquer visitante pode ver */}
            <Route
              path="/inscricao"
              element={<StaticPage src="/pages/inscricao.html" title="inscricao" />}
            />
            {/* Cadastro do candidato — exige login */}
            <Route
              path="/cadastro"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cadastro.html" title="cadastro" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cargo/saude"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cargo-saude.html" title="cargo-saude" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cargo/cajari"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cargo-cajari.html" title="cargo-cajari" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cargo/educacao"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cargo-educacao.html" title="cargo-educacao" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cargo/guarda"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cargo-guarda.html" title="cargo-guarda" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cota/saude"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cota-saude.html" title="cota-saude" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cota/cajari"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cota-cajari.html" title="cota-cajari" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cota/educacao"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cota-educacao.html" title="cota-educacao" />
                </CandidateRoute>
              }
            />
            <Route
              path="/cota/guarda"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/cota-guarda.html" title="cota-guarda" />
                </CandidateRoute>
              }
            />

            {/* Revisão final */}
            <Route
              path="/revisao/:concurso"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/revisao.html" title="revisao" />
                </CandidateRoute>
              }
            />

            {/* Lista de Minhas Inscrições */}
            <Route
              path="/inscricoes"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/inscricoes-lista.html" title="inscricoes-lista" />
                </CandidateRoute>
              }
            />

            {/* Detalhe da inscrição (pós-finalização: pagamento, status, etapas) */}
            <Route
              path="/inscricao/:id"
              element={
                <CandidateRoute>
                  <StaticPage src="/pages/inscricao-detalhe.html" title="inscricao-detalhe" />
                </CandidateRoute>
              }
            />

            {/* Admin */}
            <Route path="/donaspainel/login" element={<AdminLogin />} />
            <Route
              path="/donaspainel"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />

            {/* Qualquer rota desconhecida volta pra /home */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
