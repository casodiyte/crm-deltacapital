import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "@/auth/useAuth";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { RoleGuard } from "@/auth/RoleGuard";
import { DashboardLayout } from "@/auth/DashboardLayout";
import { LoginPage } from "@/components/atomic-crm/login/LoginPage";
import { Dashboard } from "@/modules/dashboard/Dashboard";
import { ProspectosList } from "@/modules/prospectos/ProspectosList";
import { NegociacionesKanban } from "@/modules/negociaciones/NegociacionesKanban";
import { ContactosList } from "@/modules/contactos/ContactosList";
import { ContactCenter } from "@/modules/contact-center/ContactCenter";
import { ChatInterno } from "@/modules/chat/ChatInterno";
import { AdminPanel } from "@/modules/admin/AdminPanel";
import { RegisterInternal } from "@/modules/admin/RegisterInternal";

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected CRM Routes inside DashboardLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prospectos"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProspectosList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/negociaciones"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <NegociacionesKanban />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contactos"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactosList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contact-center"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ContactCenter />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ChatInterno />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/register-kovex-internal"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["SUPERADMIN"]}>
                  <DashboardLayout>
                    <RegisterInternal />
                  </DashboardLayout>
                </RoleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["SUPERADMIN"]}>
                  <DashboardLayout>
                    <AdminPanel />
                  </DashboardLayout>
                </RoleGuard>
              </ProtectedRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
