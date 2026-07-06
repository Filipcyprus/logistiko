"use client";
import DocForm from "@/components/DocForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewOrderPage() {
  const { t } = useLanguage();
  return <DocForm collection="orders" title={t("documents.newOrderTitle")} dateFieldLabel={t("documents.deliveryDate")} backHref="/paraggelies" />;
}
