import type { Metadata } from "next";
import { LegalStub } from "@/components/LegalStub";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <LegalStub titleKey="privacy" />;
}
