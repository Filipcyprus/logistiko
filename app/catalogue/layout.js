// Δημόσια σελίδα καταλόγου: τίτλος/περιγραφή για τα link-preview (WhatsApp, Instagram, Google) και γραμματοσειρές.
export const metadata = {
  title: "DUBAI AROMAS CYPRUS | Arabic Perfume Collection",
  description: "Discover the DUBAI AROMAS CYPRUS collection of Arabic perfumes. Browse the fragrances and send your order.",
  openGraph: { title: "DUBAI AROMAS CYPRUS", description: "Arabic perfume collection — browse and order.", type: "website" },
  manifest: undefined,
};

export const viewport = { themeColor: "#0a0a0a" };

export default function CatalogueLayout({ children }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500&display=swap"
      />
      {children}
    </>
  );
}
