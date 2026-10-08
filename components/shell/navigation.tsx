"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  PanelsTopLeft,
  Menu,
  Orbit,
  ArrowUpRight,
  UserRound,
  Bookmark,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { Sheet } from "@/components/ui/overlays";
import { IconButton } from "@/components/ui/primitives";

const destinations = [
  { href: "/", label: "Home", icon: House },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/messages", label: "Messages", icon: PanelsTopLeft },
  { href: "/creator", label: "Creator studio", icon: PanelsTopLeft },
  { href: "/marketplace", label: "Marketplace", icon: Orbit },
  { href: "/assistant", label: "Writing & AI tools", icon: PanelsTopLeft },
  { href: "/wellbeing", label: "Well-being", icon: UserRound },
  { href: "/communities", label: "Communities", icon: Orbit },
  { href: "/search", label: "Search", icon: PanelsTopLeft },
  { href: "/pages", label: "Business pages", icon: PanelsTopLeft },
  { href: "/privacy", label: "Privacy", icon: UserRound },
  { href: "/safety", label: "Safety center", icon: Orbit },
  { href: "/reports", label: "Reports and appeals", icon: PanelsTopLeft },
  { href: "/moderation", label: "Moderation", icon: PanelsTopLeft },
  { href: "/groups", label: "Group conversations", icon: Orbit },
  { href: "/stories", label: "Stories", icon: PanelsTopLeft },
  { href: "/reels", label: "Reels", icon: PanelsTopLeft },
  { href: "/videos", label: "Videos", icon: PanelsTopLeft },
  { href: "/live", label: "Live studio", icon: Orbit },
  { href: "/create", label: "Create post", icon: PanelsTopLeft },
  { href: "/drafts", label: "Drafts", icon: PanelsTopLeft },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/connections", label: "Connections", icon: Orbit },
  { href: "/account", label: "Account", icon: UserRound },
  { href: "/overview", label: "Overview", icon: PanelsTopLeft },
  { href: "/design-system", label: "Component library", icon: PanelsTopLeft },
];
type NavigationProps = {
  label?: string;
  onNavigate?: () => void;
  compact?: boolean;
};
export function Navigation(props: NavigationProps) {
  return (
    <Suspense fallback={<NavigationLinks {...props} />}>
      <ActiveNavigation {...props} />
    </Suspense>
  );
}
function ActiveNavigation(props: NavigationProps) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <NavigationLinks {...props} pathname={hydrated ? pathname : undefined} />
  );
}
function NavigationLinks({
  label = "Primary",
  onNavigate,
  compact = false,
  pathname,
}: NavigationProps & { pathname?: string }) {
  return (
    <nav aria-label={label} className="navigation">
      {(compact
        ? destinations.filter((d) =>
            ["/", "/saved", "/profile"].includes(d.href),
          )
        : destinations
      ).map(({ href, label: text, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={
            pathname === href ||
            (href === "/profile" && pathname?.startsWith("/profile/")) ||
            (href === "/account" && pathname?.startsWith("/account/"))
              ? "page"
              : undefined
          }
          className="nav-link"
        >
          <Icon size={20} aria-hidden="true" />
          <span>{text}</span>
        </Link>
      ))}
    </nav>
  );
}
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="compact-nav">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        trigger={
          <IconButton label="Open navigation">
            <Menu size={21} aria-hidden="true" />
          </IconButton>
        }
        title="Find your way"
        description="Explore the application foundation."
      >
        <Navigation label="Compact" onNavigate={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}
export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <p className="eyebrow">WORKSPACE</p>
      <Navigation />
      <div className="sidebar-note">
        <Orbit size={24} aria-hidden="true" />
        <strong>A considered beginning</strong>
        <p>One shared language for every screen and interaction.</p>
        <Link href="/design-system#tokens">
          Explore the foundations <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="sidebar-footer">
        <span className="status-dot" />
        Design preview · No connected services
      </div>
    </aside>
  );
}
export function BottomNavigation() {
  return (
    <div className="bottom-nav">
      <Navigation label="Mobile" compact />
    </div>
  );
}
