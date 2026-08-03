// Καταστάσεις προσφορών/παραγγελιών — μεταφρασμένες μέσω t().
export function getTenderStatusMap(t) {
  return {
    draft: { label: t("tenderStatus.draft"), color: "bg-slate-100 text-slate-600" },
    sent: { label: t("tenderStatus.sent"), color: "bg-sky-100 text-sky-700" },
    approved: { label: t("tenderStatus.approved"), color: "bg-emerald-100 text-emerald-700" },
    rejected: { label: t("tenderStatus.rejected"), color: "bg-red-100 text-red-700" },
    ordered: { label: t("tenderStatus.ordered"), color: "bg-violet-100 text-violet-700" },
  };
}

export function getOrderStatusMap(t) {
  return {
    open: { label: t("orderStatus.open"), color: "bg-sky-100 text-sky-700" },
    approved: { label: t("orderStatus.approved"), color: "bg-emerald-100 text-emerald-700" },
    in_progress: { label: t("orderStatus.in_progress"), color: "bg-amber-100 text-amber-700" },
    ready: { label: t("orderStatus.ready"), color: "bg-emerald-100 text-emerald-700" },
    delivered: { label: t("orderStatus.delivered"), color: "bg-slate-100 text-slate-600" },
    invoiced: { label: t("orderStatus.invoiced"), color: "bg-brand-100 text-brand-700" },
  };
}
