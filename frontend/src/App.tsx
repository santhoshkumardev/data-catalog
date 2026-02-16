import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";

const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const AuthCallbackPage = React.lazy(() => import("./pages/AuthCallbackPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const DatabaseListPage = React.lazy(() => import("./pages/DatabaseListPage"));
const DatabaseDetailPage = React.lazy(() => import("./pages/DatabaseDetailPage"));
const SchemaDetailPage = React.lazy(() => import("./pages/SchemaDetailPage"));
const TableDetailPage = React.lazy(() => import("./pages/TableDetailPage"));
const ColumnDetailPage = React.lazy(() => import("./pages/ColumnDetailPage"));
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const QueriesPage = React.lazy(() => import("./pages/QueriesPage"));
const QueryDetailPage = React.lazy(() => import("./pages/QueryDetailPage"));
const ArticlesPage = React.lazy(() => import("./pages/ArticlesPage"));
const ArticleDetailPage = React.lazy(() => import("./pages/ArticleDetailPage"));
const GlossaryPage = React.lazy(() => import("./pages/GlossaryPage"));
const GlossaryTermPage = React.lazy(() => import("./pages/GlossaryTermPage"));
const NotificationsPage = React.lazy(() => import("./pages/NotificationsPage"));
const WebhooksPage = React.lazy(() => import("./pages/WebhooksPage"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] text-gray-400">Loading...</div>
);

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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/databases" element={<DatabaseListPage />} />
          <Route path="/databases/:id" element={<DatabaseDetailPage />} />
          <Route path="/schemas/:id" element={<SchemaDetailPage />} />
          <Route path="/tables/:id" element={<TableDetailPage />} />
          <Route path="/columns/:id" element={<ColumnDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/queries" element={<QueriesPage />} />
          <Route path="/queries/:id" element={<QueryDetailPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/glossary/:id" element={<GlossaryTermPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
