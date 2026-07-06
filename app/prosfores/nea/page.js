"use client";
import DocForm from "@/components/DocForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewQuotePage() {
  const { t } = useLanguage();
  return <DocForm collection="quotes" title={t("documents.newQuoteTitle")} dateFieldLabel={t("documents.validUntil")} backHref="/prosfores" />;
}
