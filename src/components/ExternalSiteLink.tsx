import type { ReactNode } from "react";
import { IconArrowUpRight, IconGlobe } from "./icons";

/** A link that leaves this site: globe, label, then an arrow up and to the right. */
export function ExternalSiteLink({
  href,
  className,
  children,
  rel = "noopener noreferrer",
}: {
  href: string;
  className?: string;
  children: ReactNode;
  rel?: string;
}) {
  return (
    <a className={className ? `ext ${className}` : "ext"} href={href} target="_blank" rel={rel}>
      <IconGlobe />
      <span className="ext-label">{children}</span>
      <IconArrowUpRight />
    </a>
  );
}
