"use client";

// Ελαφρύ, ενιαίο σύνολο γραμμικών εικονιδίων (χωρίς emoji) για επαγγελματική εμφάνιση.
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  quote: (
    <>
      <path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M14 2v5.5h5.5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>
  ),
  order: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <line x1="8.5" y1="10.5" x2="15.5" y2="10.5" />
      <line x1="8.5" y1="14.5" x2="15.5" y2="14.5" />
      <line x1="8.5" y1="18" x2="12.5" y2="18" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 2h12v18.5l-1.8-1.3-1.7 1.3-1.7-1.3-1.8 1.3-1.7-1.3-1.8 1.3-1.5-1.3V2z" />
      <line x1="8.3" y1="7" x2="15.7" y2="7" />
      <line x1="8.3" y1="11" x2="15.7" y2="11" />
      <line x1="8.3" y1="15" x2="12.5" y2="15" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20.5c0-3.6 2.7-6.3 6-6.3s6 2.7 6 6.3" />
      <circle cx="17.2" cy="9" r="2.4" />
      <path d="M15.8 14.3c2.5.3 4.7 2.5 4.7 6.2" />
    </>
  ),
  truck: (
    <>
      <rect x="1.5" y="7" width="12.5" height="9.5" rx="1" />
      <path d="M14 10h4.2l3.3 3.3v3.2H14z" />
      <circle cx="6" cy="18.5" r="1.7" />
      <circle cx="17.5" cy="18.5" r="1.7" />
    </>
  ),
  box: (
    <>
      <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3z" />
      <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="6" width="20" height="13.5" rx="2" />
      <path d="M2 10.2h20" />
      <circle cx="17" cy="14.3" r="1.3" />
    </>
  ),
  report: (
    <>
      <line x1="3.5" y1="20.5" x2="20.5" y2="20.5" />
      <rect x="5.5" y="12" width="3.4" height="8.2" />
      <rect x="10.8" y="7.5" width="3.4" height="12.7" />
      <rect x="16.1" y="3.5" width="3.4" height="16.7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M1.5 12h3M19.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" />
    </>
  ),
  jobs: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="10.5" rx="1" />
      <rect x="16" y="4" width="5" height="13.5" rx="1" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  edit: (
    <>
      <path d="M12.3 20h8.2" />
      <path d="M16.8 3.4a2.1 2.1 0 0 1 3 3L7.3 18.9l-4 1 1-4L16.8 3.4z" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 6h17" />
      <path d="M8.5 6V4.2A1.7 1.7 0 0 1 10.2 2.5h3.6a1.7 1.7 0 0 1 1.7 1.7V6" />
      <path d="M18.5 6 17.6 19.5a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6" />
      <line x1="10.2" y1="10.5" x2="10.2" y2="16.5" />
      <line x1="13.8" y1="10.5" x2="13.8" y2="16.5" />
    </>
  ),
  eye: (
    <>
      <path d="M1.3 12S5.2 5.3 12 5.3 22.7 12 22.7 12 18.8 18.7 12 18.7 1.3 12 1.3 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  printer: (
    <>
      <path d="M6.5 8.8V3.3h11v5.5" />
      <rect x="4" y="8.8" width="16" height="7.7" rx="1.3" />
      <path d="M6.5 16.5v4.2h11v-4.2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="7" />
      <line x1="20.5" y1="20.5" x2="15.8" y2="15.8" />
    </>
  ),
  money: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="9.2" x2="6.01" y2="9.2" />
      <line x1="18" y1="14.8" x2="18.01" y2="14.8" />
    </>
  ),
  link: (
    <>
      <path d="M9.2 17H7.3a5 5 0 0 1 0-10h1.9" />
      <path d="M14.8 7h1.9a5 5 0 0 1 0 10h-1.9" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  external: (
    <>
      <path d="M14.5 3.5h6v6" />
      <line x1="20.3" y1="3.7" x2="10.5" y2="13.5" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  check: <polyline points="4 12.5 9 17.5 20 6" />,
  x: (
    <>
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </>
  ),
  arrowLeft: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="11 5.5 5 12 11 18.5" />
    </>
  ),
  arrowRight: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 5.5 19 12 13 18.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.3" y="5" width="17.4" height="16" rx="2" />
      <line x1="15.7" y1="3" x2="15.7" y2="7" />
      <line x1="8.3" y1="3" x2="8.3" y2="7" />
      <line x1="3.3" y1="10" x2="20.7" y2="10" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7.3a4 4 0 0 1 8 0V11" />
    </>
  ),
  cart: (
    <>
      <circle cx="9.2" cy="20" r="1.3" />
      <circle cx="17.8" cy="20" r="1.3" />
      <path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.7L21 8H6.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5.2 2 6.2 2 6.2H4S6 14.2 6 9z" />
      <path d="M10.2 19.8a2 2 0 0 0 3.6 0" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h8l10 10-8 8L3 11V3z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="6.5" x2="20" y2="6.5" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17.5" x2="20" y2="17.5" />
    </>
  ),
  chevronDown: <polyline points="6 9.5 12 15.5 18 9.5" />,
  download: (
    <>
      <path d="M12 3v12.5" />
      <polyline points="7 11 12 15.5 17 11" />
      <path d="M4.5 17v2.5A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21v-12.5" />
      <polyline points="7 12.5 12 8 17 12.5" />
      <path d="M4.5 17v2.5A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3.5 21 9 15.5 9" />
    </>
  ),
  scan: (
    <>
      <path d="M3.5 8V5.5A2 2 0 0 1 5.5 3.5H8" />
      <path d="M16 3.5h2.5a2 2 0 0 1 2 2V8" />
      <path d="M20.5 16v2.5a2 2 0 0 1-2 2H16" />
      <path d="M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </>
  ),
  note: (
    <>
      <path d="M5.5 2.5h9L19 8v13a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-17.5a1 1 0 0 1 1-1z" />
      <path d="M14 2.5V8h5" />
      <line x1="7.5" y1="12" x2="16" y2="12" />
      <line x1="7.5" y1="15.5" x2="16" y2="15.5" />
      <line x1="7.5" y1="19" x2="12.5" y2="19" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <circle cx="8.3" cy="9.5" r="1.9" />
      <path d="M4 18l5.5-5.5a2 2 0 0 1 2.8 0L16 16" />
      <path d="M14.5 14.5 16.3 12.7a2 2 0 0 1 2.8 0L21.5 15.2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 2.5 2.5 8 12 13.5 21.5 8 12 2.5z" />
      <path d="M2.5 13 12 18.5 21.5 13" />
    </>
  ),
};

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.75 }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
