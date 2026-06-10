import { Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { AdminLayout } from "./AdminLayout";
import { AdminLoginPage } from "./AdminLoginPage";
import {
  AdminOverviewPage,
  AdminPlaceholderPage,
} from "./pages/AdminOverviewPage";
import { PricingPage } from "./pages/PricingPage";
import { GamesUploadPage } from "./pages/GamesUploadPage";
import { RomsPage } from "./pages/RomsPage";
import { FinancialPage } from "./pages/FinancialPage";
import { UsagePage } from "./pages/UsagePage";

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
        <Route path="jogos" element={<GamesUploadPage />} />
        <Route path="rooms" element={<RomsPage />} />
        <Route path="financeiro" element={<FinancialPage />} />
        <Route path="uso" element={<UsagePage />} />
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
