"use client";
import DocForm from "@/components/DocForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewTenderPage() {
  const { t } = useLanguage();
  return <DocForm collection="tenders" title={t("documents.newTenderTitle")} dateFieldLabel={t("documents.validUntil")} backHref="/prosfores" />;
}
