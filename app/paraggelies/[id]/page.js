"use client";
import DocView from "@/components/DocView";
import { getOrderStatusMap } from "@/lib/statuses";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function OrderView() {
  const { t } = useLanguage();
  return <DocView collection="orders" kind="order" label={t("documents.orderLabel")} statusMap={getOrderStatusMap(t)} canConvertToOrder={false} backHref="/paraggelies" />;
}
