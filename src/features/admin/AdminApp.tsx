import { Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { AdminLayout } from "./AdminLayout";
import { AdminLoginPage } from "./AdminLoginPage";
import {
  AdminOverviewPage,
  AdminPlaceholderPage,
} from "./pages/AdminOverviewPage";
import { PricingPage } from "./pages/PricingPage";

function AdminGate() {
  const { isAuthed } = useAdminAuth();

  if (!isAuthed) {
    return <AdminLoginPage />;
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="precos" element={<PricingPage />} />
        <Route
          path="jogos"
          element={<AdminPlaceholderPage title="Jogos / Upload" />}
        />
        <Route path="rooms" element={<AdminPlaceholderPage title="Rooms" />} />
        <Route
          path="financeiro"
          element={<AdminPlaceholderPage title="Financeiro" />}
        />
        <Route
          path="uso"
          element={<AdminPlaceholderPage title="Controle de uso" />}
        />
        <Route path="saves" element={<AdminPlaceholderPage title="Saves" />} />
        <Route
          path="catalogo"
          element={<AdminPlaceholderPage title="Catálogo" />}
        />
        <Route path="*" element={<AdminOverviewPage />} />
      </Route>
    </Routes>
  );
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
