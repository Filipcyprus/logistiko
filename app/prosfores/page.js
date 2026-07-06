"use client";
import DocList from "@/components/DocList";
import { getQuoteStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function QuotesPage() {
  const { t } = useLanguage();
  return <DocList collection="quotes" title={t("documents.quotesTitle")} newHref="/prosfores/nea" viewHref="/prosfores" newLabel={t("documents.newQuote")} statusMap={getQuoteStatusMap(t)} />;
}
