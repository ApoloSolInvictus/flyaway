"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, LogIn, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function AuthPanel() {
  const { isFirebaseReady, register, resetPassword, signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (mode === "register") {
        await register({ name, email, password });
      } else {
        await signIn({ email, password });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo autenticar el perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setMessage("Escribe tu email para enviar el enlace de recuperación.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await resetPassword(email);
      setMessage("Revisa tu correo para restablecer la contraseña.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el enlace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-panel" aria-labelledby="auth-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Perfil seguro</p>
          <h2 id="auth-title">Acceso FlyAway</h2>
        </div>
        <Mail aria-hidden="true" />
      </div>

      {!isFirebaseReady ? (
        <div className="notice warning">
          <AlertTriangle aria-hidden="true" />
          <span>Faltan variables públicas de Firebase.</span>
        </div>
      ) : null}

      <div className="segmented" role="tablist" aria-label="Modo de acceso">
        <button
          type="button"
          className={mode === "signin" ? "selected" : ""}
          onClick={() => setMode("signin")}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === "register" ? "selected" : ""}
          onClick={() => setMode("register")}
        >
          Crear perfil
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            Nombre
            <input
              autoComplete="name"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              type="text"
              value={name}
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label>
          Contraseña
          <input
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <button className="primary-button" disabled={busy || !isFirebaseReady} type="submit">
          {mode === "register" ? <UserPlus aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          {mode === "register" ? "Crear perfil" : "Entrar"}
        </button>
      </form>

      <button className="text-button" disabled={busy || !isFirebaseReady} onClick={handleResetPassword} type="button">
        Recuperar contraseña
      </button>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
