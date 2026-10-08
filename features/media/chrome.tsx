import Link from "next/link";
import { Clapperboard, Radio, Layers, Film } from "lucide-react";
export function MediaNavigation({
  active,
}: {
  active: "stories" | "reels" | "videos" | "live";
}) {
  return (
    <nav className="rich-media-nav" aria-label="Media experiences">
      {[
        { path: "stories", name: "Stories", Icon: Layers },
        { path: "reels", name: "Reels", Icon: Clapperboard },
        { path: "videos", name: "Videos", Icon: Film },
        { path: "live", name: "Live", Icon: Radio },
      ].map(({ path, name, Icon }) => (
        <Link
          key={path}
          href={`/${path}`}
          aria-current={active === path ? "page" : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {name}
        </Link>
      ))}
    </nav>
  );
}
export function MediaNotice() {
  return (
    <p className="alert alert-warning">
      Development preview · Bundled synthetic artwork and animation, not
      published user media. Reactions, comments, saves and highlights are
      development-only. New media stays in the private Phase 06 workflow;
      simulated approval never enables distribution.
    </p>
  );
}
