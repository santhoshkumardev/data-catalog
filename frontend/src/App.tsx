import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import DatabaseListPage from "./pages/DatabaseListPage";
import DatabaseDetailPage from "./pages/DatabaseDetailPage";
import SchemaDetailPage from "./pages/SchemaDetailPage";
import TableDetailPage from "./pages/TableDetailPage";
import SearchPage from "./pages/SearchPage";
import AdminPage from "./pages/AdminPage";
import QueriesPage from "./pages/QueriesPage";
import QueryDetailPage from "./pages/QueryDetailPage";
import ArticlesPage from "./pages/ArticlesPage";
import ArticleDetailPage from "./pages/ArticleDetailPage";
import GlossaryPage from "./pages/GlossaryPage";
import GlossaryTermPage from "./pages/GlossaryTermPage";
import NotificationsPage from "./pages/NotificationsPage";
import FavoritesPage from "./pages/FavoritesPage";
import WebhooksPage from "./pages/WebhooksPage";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/databases" element={<DatabaseListPage />} />
        <Route path="/databases/:id" element={<DatabaseDetailPage />} />
        <Route path="/schemas/:id" element={<SchemaDetailPage />} />
        <Route path="/tables/:id" element={<TableDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/queries" element={<QueriesPage />} />
        <Route path="/queries/:id" element={<QueryDetailPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:id" element={<ArticleDetailPage />} />
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/glossary/:id" element={<GlossaryTermPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
