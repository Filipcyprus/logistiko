"use client";
import DocList from "@/components/DocList";
import { getTenderStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function TendersPage() {
  const { t } = useLanguage();
  return <DocList collection="tenders" title={t("documents.tendersTitle")} newHref="/prosfores/nea" viewHref="/prosfores" newLabel={t("documents.newTender")} statusMap={getTenderStatusMap(t)} />;
}
