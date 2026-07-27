import { NextResponse } from "next/server";

// Δυναμικό web app manifest ανά token, ώστε η εγκατεστημένη εφαρμογή να ανοίγει
// κατευθείαν στο portal του συγκεκριμένου συνεργάτη (όχι στη σελίδα του προσωπικού).
export async function GET(request, { params }) {
  const { token } = params;
  const manifest = {
    name: "Logistiko Partner Portal",
    short_name: "Partner Portal",
    description: "Παρακολούθηση δουλειών, τιμολόγηση και μηνύματα με τον συνεργάτη",
    start_url: `/partner-portal/${token}`,
    scope: `/partner-portal/${token}`,
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#4d6690",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
