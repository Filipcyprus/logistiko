"use client";
import DocView from "@/components/DocView";
import { getQuoteStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function QuoteView() {
  const { t } = useLanguage();
  return <DocView collection="quotes" kind="quote" label={t("documents.quoteLabel")} statusMap={getQuoteStatusMap(t)} canConvertToOrder backHref="/prosfores" />;
}
