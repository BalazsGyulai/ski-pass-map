import type { Metadata } from "next";
import { LegalStub } from "@/components/LegalStub";

export const metadata: Metadata = { title: "Imprint" };

export default function ImprintPage() {
  return <LegalStub titleKey="imprint" />;
}
