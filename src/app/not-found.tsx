import Link from "next/link";
import { defaultLangHome } from "@/i18n/routing";

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <h1>That page is not on this map.</h1>
      <p>
        <Link href={defaultLangHome()}>Back to the map</Link>
      </p>
    </div>
  );
}
