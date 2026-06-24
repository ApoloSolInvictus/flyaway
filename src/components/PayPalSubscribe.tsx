"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function PayPalSubscribe() {
  const { refreshProfile, user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!paypalClientId) {
    return (
      <section className="panel subscribe-panel" aria-labelledby="subscribe-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Suscripción</p>
            <h2 id="subscribe-title">$1.77 / mes</h2>
          </div>
          <CreditCard aria-hidden="true" />
        </div>
        <div className="notice warning">
          <AlertTriangle aria-hidden="true" />
          <span>Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel subscribe-panel" aria-labelledby="subscribe-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Suscripción</p>
          <h2 id="subscribe-title">$1.77 / mes por perfil</h2>
        </div>
        <CreditCard aria-hidden="true" />
      </div>

      <PayPalScriptProvider
        options={{
          clientId: paypalClientId,
          components: "buttons",
          currency: "USD",
          intent: "subscription",
          vault: true,
        }}
      >
        <PayPalButtons
          style={{
            color: "gold",
            label: "subscribe",
            layout: "vertical",
            shape: "rect",
          }}
          createSubscription={async () => {
            if (!user) {
              throw new Error("Necesitas iniciar sesión.");
            }

            setMessage(null);
            const token = await user.getIdToken();
            const response = await fetch("/api/paypal/create-subscription", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              const data = (await response.json()) as { error?: string };
              throw new Error(data.error ?? "No se pudo crear la suscripción.");
            }

            const data = (await response.json()) as { subscriptionId: string };
            return data.subscriptionId;
          }}
          onApprove={async (data) => {
            const subscriptionId = data.subscriptionID;

            if (!user || !subscriptionId) {
              setMessage("PayPal aprobó, pero no devolvió un ID de suscripción.");
              return;
            }

            setSyncing(true);

            try {
              const token = await user.getIdToken(true);
              const response = await fetch("/api/subscription/sync", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ subscriptionId }),
              });

              if (!response.ok) {
                const body = (await response.json()) as { error?: string };
                throw new Error(body.error ?? "No se pudo sincronizar la suscripción.");
              }

              await refreshProfile(true);
              setMessage("Suscripción activa. El emisor FlyAway está desbloqueado.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "PayPal aprobó, pero falta sincronizar.");
            } finally {
              setSyncing(false);
            }
          }}
          onCancel={() => setMessage("Suscripción cancelada antes de finalizar.")}
          onError={(error) => setMessage(error instanceof Error ? error.message : "PayPal no pudo completar el flujo.")}
        />
      </PayPalScriptProvider>

      <button className="secondary-button" disabled={syncing || !user} onClick={() => void refreshProfile(true)} type="button">
        <RefreshCw aria-hidden="true" />
        Actualizar estado
      </button>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
