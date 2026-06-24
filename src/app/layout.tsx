import type { Metadata, Viewport } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "FlyAway",
  description: "Perfil, suscripcion y emision ultrasónica configurable para FlyAway.",
  applicationName: "FlyAway",
  icons: {
    icon: "/flyaway-mark.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#202020",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
