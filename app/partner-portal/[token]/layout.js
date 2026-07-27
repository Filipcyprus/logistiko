export async function generateMetadata({ params }) {
  const { token } = params;
  return {
    title: "Logistiko Partner Portal",
    manifest: `/api/partner-portal/${token}/manifest`,
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Partner Portal" },
  };
}

export default function PartnerPortalTokenLayout({ children }) {
  return children;
}
