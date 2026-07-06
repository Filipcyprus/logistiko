// Καταστάσεις προσφορών/παραγγελιών — μεταφρασμένες μέσω t().
export function getQuoteStatusMap(t) {
  return {
    draft: { label: t("quoteStatus.draft"), color: "bg-slate-100 text-slate-600" },
    sent: { label: t("quoteStatus.sent"), color: "bg-sky-100 text-sky-700" },
    accepted: { label: t("quoteStatus.accepted"), color: "bg-emerald-100 text-emerald-700" },
    rejected: { label: t("quoteStatus.rejected"), color: "bg-red-100 text-red-700" },
    ordered: { label: t("quoteStatus.ordered"), color: "bg-violet-100 text-violet-700" },
    invoiced: { label: t("quoteStatus.invoiced"), color: "bg-brand-100 text-brand-700" },
  };
}

export function getOrderStatusMap(t) {
  return {
    open: { label: t("orderStatus.open"), color: "bg-sky-100 text-sky-700" },
    in_progress: { label: t("orderStatus.in_progress"), color: "bg-amber-100 text-amber-700" },
    ready: { label: t("orderStatus.ready"), color: "bg-emerald-100 text-emerald-700" },
    delivered: { label: t("orderStatus.delivered"), color: "bg-slate-100 text-slate-600" },
    invoiced: { label: t("orderStatus.invoiced"), color: "bg-brand-100 text-brand-700" },
  };
}
