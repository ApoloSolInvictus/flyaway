"use client";

import { AlertTriangle, Bug, CheckCircle2, LogOut, RefreshCw, ShieldCheck, User } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { PayPalSubscribe } from "@/components/PayPalSubscribe";
import { UltrasonicEmitter } from "@/components/UltrasonicEmitter";
import { useAuth } from "@/context/AuthContext";

function subscriptionLabel(status?: string) {
  switch (status) {
    case "active":
      return "Activa";
    case "pending":
      return "Pendiente";
    case "suspended":
      return "Suspendida";
    case "cancelled":
      return "Cancelada";
    case "expired":
      return "Expirada";
    default:
      return "Inactiva";
  }
}

export function Dashboard() {
  const { error, loading, profile, refreshProfile, signOut, user } = useAuth();
  const subscriptionStatus = profile?.subscriptionStatus ?? "inactive";
  const isActive = subscriptionStatus === "active";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <img alt="" height={44} src="/flyaway-mark.svg" width={44} />
          <div>
            <p className="eyebrow">Lux Aeterna</p>
            <h1>FlyAway</h1>
          </div>
        </div>

        {user ? (
          <div className="topbar-actions">
            <span className={isActive ? "status-pill active" : "status-pill locked"}>
              {isActive ? <CheckCircle2 aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
              {subscriptionLabel(subscriptionStatus)}
            </span>
            <button className="icon-button" onClick={signOut} title="Salir" type="button">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="notice warning wide">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="workspace">
        {!user ? (
          <>
            <section className="panel intro-panel" aria-labelledby="intro-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Control ultrasónico</p>
                  <h2 id="intro-title">Moscas y mosquitos</h2>
                </div>
                <Bug aria-hidden="true" />
              </div>
              <div className="frequency-band" aria-hidden="true">
                <span style={{ width: "18%" }} />
                <span style={{ width: "32%" }} />
                <span style={{ width: "50%" }} />
              </div>
              <p className="plain-copy">
                Emisión configurable con perfil de usuario, suscripción mensual y APIs serverless para Vercel.
              </p>
              <div className="notice safety">
                <AlertTriangle aria-hidden="true" />
                <span>La eficacia depende de especie, ambiente, altavoz y distancia. No sustituye control sanitario.</span>
              </div>
            </section>
            <AuthPanel />
          </>
        ) : (
          <>
            <section className="panel profile-panel" aria-labelledby="profile-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Perfil</p>
                  <h2 id="profile-title">{profile?.displayName || user.displayName || "Socio FlyAway"}</h2>
                </div>
                <User aria-hidden="true" />
              </div>

              <dl className="profile-list">
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>$1.77 USD mensual</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{subscriptionLabel(subscriptionStatus)}</dd>
                </div>
              </dl>

              <button className="secondary-button" disabled={loading} onClick={() => void refreshProfile(true)} type="button">
                <RefreshCw aria-hidden="true" />
                Actualizar
              </button>
            </section>

            {!isActive ? <PayPalSubscribe /> : null}
            <UltrasonicEmitter enabled={isActive} />
          </>
        )}
      </div>
    </main>
  );
}
