import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface AuthProvider {
  name: string;
  label: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    api.get<{ providers: AuthProvider[] }>("/auth/providers").then((res) => setProviders(res.data.providers)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      await login(res.data.access_token);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email: demoEmail, password: demoPassword });
      await login(res.data.access_token);
      navigate("/");
    } catch {
      setError("Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-1">Data Catalog v2</h1>
          <p className="text-gray-500 text-center mb-6">Sign in to your account</p>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded p-3 mb-4">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" required
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {providers.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <span className="relative bg-white px-2 text-xs text-gray-400">or</span>
              </div>
              {providers.map((p) => (
                <a
                  key={p.name}
                  href={`${api.defaults.baseURL}/auth/login/${p.name}`}
                  className="w-full flex items-center justify-center gap-2 border rounded px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Sign in with {p.label}
                </a>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-400 text-center mb-3">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { email: "steward@demo.com", password: "steward123", role: "Steward" },
                { email: "viewer@demo.com", password: "viewer123", role: "Viewer" },
              ].map((d) => (
                <button
                  key={d.email}
                  onClick={() => demoLogin(d.email, d.password)}
                  className="text-xs border rounded px-2 py-1.5 hover:bg-gray-50 text-gray-600"
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
