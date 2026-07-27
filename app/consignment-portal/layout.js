export const metadata = {
  title: "Logistiko Consignment Portal",
  manifest: "/consignment-manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Consignment" },
};

export default function ConsignmentPortalLayout({ children }) {
  return children;
}
