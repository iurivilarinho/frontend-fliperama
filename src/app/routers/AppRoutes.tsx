import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
// import { ProtectedRoute } from "./ProtectedRoute";
import { GamesPage } from "../../features/totem/GamesPage";
import { PlatformSelectionPage } from "../../features/totem/PlatformSelectionPage";
import { NotFound } from "../../features/shared/NotFound";
import { SessionMiniOverlayPage } from "../../features/totem/session/SessionMiniOverlayPage";
import { AdminApp } from "../../features/admin/AdminApp";
import { ROUTES } from "./routes";

/** Atalho global para abrir o painel admin: Ctrl+Shift+A. */
function AdminShortcut() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        navigate("/admin");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return null;
}

export const AppRoutes = () => (
  <>
    <AdminShortcut />
    <Routes>
      <Route>
        <Route path={ROUTES.homepage} element={<PlatformSelectionPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path={ROUTES.player_mini} element={<SessionMiniOverlayPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Route>
      <Route path={ROUTES.notFound} element={<NotFound />} />
    </Routes>
  </>
);
