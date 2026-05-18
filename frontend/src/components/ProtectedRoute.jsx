import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LogoutButton from "@/components/LogoutButton";

export function CandidateRoute({ children }) {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      {children}
      <LogoutButton />
    </>
  );
}

export function AdminRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  if (!token) return <Navigate to="/donaspainel/login" replace />;
  return children;
}
