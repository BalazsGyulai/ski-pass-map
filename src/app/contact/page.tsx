import type { Metadata } from "next";
import { LegalStub } from "@/components/LegalStub";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return <LegalStub titleKey="contact" />;
}
