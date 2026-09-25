import type { Metadata } from "next";
import { Planner } from "@/components/Planner";

export const metadata: Metadata = { title: "Planner" };

export default function PlanPage() {
  return <Planner />;
}
