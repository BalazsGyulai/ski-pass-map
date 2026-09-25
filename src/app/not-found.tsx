import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <h1>That page is not on this map. / Ez az oldal nincs a térképen.</h1>
      <p>
        <Link href="/">Back to the map / Vissza a térképre</Link>
      </p>
    </div>
  );
}
