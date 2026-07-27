export async function generateMetadata({ params }) {
  const { token } = params;
  return {
    title: "Logistiko Παραγγελίες",
    manifest: `/api/portal/${token}/manifest`,
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Παραγγελίες" },
  };
}

export default function PortalTokenLayout({ children }) {
  return children;
}
