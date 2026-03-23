"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Falha no login.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="page">
      <section className="card loginCard glassCard">
        <div className="loginCardHeader">
          <h1 className="gradientText">Login</h1>
          <ThemeToggle />
        </div>
        <p className="helperText">
          Entre com usuario e senha para acessar seu ambiente.
        </p>
        <form className="form" onSubmit={handleLogin}>
          <label>
            Usuario
            <input
              className="uiInput"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              className="uiInput"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="saveButton uiButton" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {error ? <p className="feedbackError">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
