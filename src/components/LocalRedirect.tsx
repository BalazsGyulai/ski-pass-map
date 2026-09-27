"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { MessageKey } from "@/lib/i18n";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

/** Old addresses (/compare, /saved) move to their new home and keep the query string. */
export function LocalRedirect({ to, hash, label }: { to: string; hash?: string; label: MessageKey }) {
  const router = useRouter();
  const href = useLocalizedPath();
  const { t } = useApp();
  const target = href(to);
  useEffect(() => {
    router.replace(`${target}${window.location.search}${hash ? `#${hash}` : ""}`);
  }, [router, target, hash]);
  return (
    <div className="page page-narrow">
      <p>
        <Link href={target}>{t(label)}</Link>
      </p>
    </div>
  );
}
