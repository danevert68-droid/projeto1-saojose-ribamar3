import { useAuth } from "@/contexts/AuthContext";

// O cabeçalho do usuário (sino + email + Sair) é renderizado dentro do iframe
// das páginas legadas, via injeção JS no <header class="candidate-shell__topbar">
// (ver /app/frontend/public/pages/*.html + global-cleanup.js).
// Este componente fica como hook de presença para que o AuthProvider permaneça
// disponível; não renderiza nada no DOM React.
export default function LogoutButton() {
  const { user } = useAuth();
  void user;
  return null;
}
