"use client";
import DocView from "@/components/DocView";
import { getTenderStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function TenderView() {
  const { t } = useLanguage();
  return (
    <DocView
      collection="tenders"
      kind="tender"
      label={t("documents.tenderLabel")}
      statusMap={getTenderStatusMap(t)}
      canConvertToOrder
      requireApproval
      hideDirectInvoice
      backHref="/prosfores"
    />
  );
}
