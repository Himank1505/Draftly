import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function SignupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.auth.register({ name, email, password, role });
      login(token, user);
      navigate(user.role === "instructor" ? "/teacher" : "/assignments");
    } catch (err: any) {
      setError(err.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.brand}>Draftly</h1>
        <h2 style={s.heading}>Create account</h2>

        {error && <div style={s.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Full name</label>
          <input
            style={s.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <label style={s.label}>I am a</label>
          <div style={s.roleRow}>
            <label style={s.roleOption}>
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === "student"}
                onChange={() => setRole("student")}
              />
              <span style={s.roleLabel}>Student</span>
            </label>
            <label style={s.roleOption}>
              <input
                type="radio"
                name="role"
                value="instructor"
                checked={role === "instructor"}
                onChange={() => setRole("instructor")}
              />
              <span style={s.roleLabel}>Teacher / Instructor</span>
            </label>
          </div>

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account?{" "}
          <Link to="/login" style={s.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "2.5rem",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
  },
  brand: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: "#3b82f6",
    letterSpacing: "-0.02em",
  },
  heading: {
    margin: "0.5rem 0 1.5rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#1e293b",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { fontSize: "0.85rem", fontWeight: 600, color: "#374151" },
  input: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: "0.95rem",
    outline: "none",
    marginBottom: "0.5rem",
  },
  roleRow: {
    display: "flex",
    gap: "1.5rem",
    marginBottom: "0.5rem",
    marginTop: "0.25rem",
  },
  roleOption: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    cursor: "pointer",
  },
  roleLabel: { fontSize: "0.9rem", color: "#374151" },
  btn: {
    marginTop: "0.5rem",
    padding: "0.7rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "0.6rem 0.75rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  footer: { marginTop: "1.25rem", textAlign: "center", fontSize: "0.875rem", color: "#64748b" },
  link: { color: "#3b82f6", fontWeight: 600 },
};
