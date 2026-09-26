import type { Metadata } from "next";
import { LegalStub } from "@/components/LegalStub";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return <LegalStub titleKey="terms" />;
}
