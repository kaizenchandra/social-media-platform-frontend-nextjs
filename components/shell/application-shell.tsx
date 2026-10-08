import Link from "next/link";
import type { ReactNode } from "react";
import { Orbit, ShieldCheck, Accessibility, Palette } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { Sidebar, MobileNavigation, BottomNavigation } from "./navigation";
import { ThemeControl } from "./theme-control";

export function ApplicationShell({
  children,
  context,
}: {
  children: ReactNode;
  context?: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <MobileNavigation />
          <Link href="/" aria-label="Common home" className="brand">
            <span className="brand-symbol">
              <Orbit size={24} aria-hidden="true" />
            </span>
            common<span className="brand-period">.</span>
          </Link>
          <span className="topbar-divider" />
          <span className="topbar-caption">A little more connection.</span>
          <div className="topbar-actions">
            <Badge className="preview-badge">Design preview</Badge>
            <ThemeControl />
          </div>
        </div>
      </header>
      <div className="shell-grid">
        <Sidebar />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        {context ? (
          <aside className="context-panel" aria-label="Context">
            {context}
          </aside>
        ) : null}
      </div>
      <BottomNavigation />
    </>
  );
}
export function FoundationContext() {
  return (
    <>
      <div className="context-heading">BUILT WITH INTENTION</div>
      <div className="context-item">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Clear boundaries</strong>
          <p>No account or private content is connected in this preview.</p>
        </div>
      </div>
      <div className="context-item">
        <Accessibility size={20} aria-hidden="true" />
        <div>
          <strong>Everyone belongs</strong>
          <p>Keyboard access, readable contrast, and room for your words.</p>
        </div>
      </div>
      <div className="context-item">
        <Palette size={20} aria-hidden="true" />
        <div>
          <strong>Make it comfortable</strong>
          <p>Choose light, dark, or follow your device’s appearance.</p>
        </div>
      </div>
      <div className="context-footer">
        Phase 02 <span>Design system & shell</span>
      </div>
    </>
  );
}
