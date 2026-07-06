"use client";
import DocList from "@/components/DocList";
import { getOrderStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function OrdersPage() {
  const { t } = useLanguage();
  return <DocList collection="orders" title={t("documents.ordersTitle")} newHref="/paraggelies/nea" viewHref="/paraggelies" newLabel={t("documents.newOrder")} statusMap={getOrderStatusMap(t)} />;
}
