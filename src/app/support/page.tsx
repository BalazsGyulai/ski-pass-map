import type { Metadata } from "next";
import { LegalStub } from "@/components/LegalStub";

export const metadata: Metadata = { title: "Support Skimap" };

export default function SupportPage() {
  return <LegalStub titleKey="supportSkimap" />;
}
