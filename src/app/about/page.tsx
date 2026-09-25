import type { Metadata } from "next";
import { AboutView } from "@/components/AboutView";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <AboutView />;
}
