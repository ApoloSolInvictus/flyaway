# FlyAway

FlyAway es una web app Next.js para Vercel con perfil Firebase y suscripción mensual PayPal de **$1.77 USD por perfil**. El emisor usa Web Audio API para solicitar frecuencias entre **18 kHz y 48 kHz**, con límite automático según el muestreo real del dispositivo.

## Importante

18 kHz puede ser audible para algunas personas. La mayoría de navegadores y altavoces comunes no pueden reproducir 48 kHz reales; con audio a 48 kHz, el máximo físico suele quedar cerca de 24 kHz por el límite de Nyquist. La eficacia para ahuyentar insectos depende de especie, distancia, volumen, altavoz y ambiente. FlyAway no sustituye control sanitario, mosquiteros, eliminación de criaderos ni manejo profesional de plagas.

## Stack

- Next.js App Router
- Vercel Route Handlers para APIs
- Firebase Auth REST + Firestore REST
- PayPal Subscriptions
- Web Audio API en el navegador

## Desarrollo local

```bash
corepack enable
pnpm install
pnpm dev
```

Abre `http://localhost:3000`.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_PLAN_ID=
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
```

## Firebase

1. Crea un proyecto en Firebase.
2. Agrega una app Web y copia al menos `apiKey` y `projectId` a `NEXT_PUBLIC_FIREBASE_API_KEY` y `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
3. En Authentication, habilita Email/Password.
4. Crea Firestore en modo Native.
5. Publica `firebase.rules` en Firestore Rules.
6. Crea una service account en Firebase/Google Cloud y copia `project_id`, `client_email` y `private_key` a las variables del servidor.

## PayPal

1. En PayPal Developer, crea una REST App en Sandbox.
2. Crea un producto y un plan mensual de **$1.77 USD**.
3. Copia el plan ID en `PAYPAL_PLAN_ID`.
4. Configura un webhook apuntando a:

```text
https://TU-DOMINIO.vercel.app/api/paypal/webhook
```

Eventos recomendados:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `PAYMENT.SALE.COMPLETED`

5. Copia el webhook ID en `PAYPAL_WEBHOOK_ID`.
6. Cuando pases a producción, cambia `PAYPAL_ENV=live` y usa credenciales, plan y webhook live.

## Vercel

1. Importa este repo en Vercel.
2. Agrega todas las variables de entorno.
3. Define `NEXT_PUBLIC_APP_URL` con el dominio real de Vercel.
4. Despliega.
5. Actualiza en PayPal el webhook al dominio definitivo.

## APIs

- `GET /api/health`
- `POST /api/paypal/create-subscription`
- `POST /api/subscription/sync`
- `GET /api/subscription/status`
- `POST /api/paypal/webhook`

Las rutas privadas verifican el Firebase ID token con los certificados públicos de Google. El webhook verifica la firma con PayPal antes de escribir estados de suscripción en Firestore mediante la REST API.
