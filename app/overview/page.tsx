import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Compass,
  Sparkles,
  Check,
  LayoutGrid,
} from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";

export default function Home() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <p className="eyebrow">A THOUGHTFUL FOUNDATION</p>
        <Badge tone="success">
          <span className="status-dot" />
          Phase 02
        </Badge>
      </div>
      <section className="hero">
        <span className="hero-symbol" aria-hidden="true">
          <Compass size={36} strokeWidth={1.5} />
        </span>
        <h1>
          Good connections.
          <br />
          <span className="muted">Start with good design.</span>
        </h1>
        <p>
          A calmer space for the things that bring us together. Built on a
          shared language of clear choices, comfortable layouts, and thoughtful
          details.
        </p>
        <Link href="/design-system" className="button button-primary">
          Explore the component library{" "}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className="hero-caption">
          Design preview. No social services are connected.
        </p>
      </section>
      <div className="section-heading">
        <h2>The foundation, at a glance</h2>
        <span className="muted">Made to work together</span>
      </div>
      <div className="overview-grid">
        {[
          {
            icon: Layers,
            title: "One visual language",
            description:
              "Consistent colors, type, and spacing. A familiar rhythm across every screen.",
            detail: "Semantic tokens",
          },
          {
            icon: LayoutGrid,
            title: "Room for every screen",
            description:
              "A full workspace on desktop. A focused experience in the palm of your hand.",
            detail: "Responsive by design",
          },
          {
            icon: Sparkles,
            title: "Details that include",
            description:
              "Visible focus, clear feedback, and interactions that work with a keyboard.",
            detail: "Accessible interactions",
          },
        ].map(({ icon: Icon, title, description, detail }) => (
          <Card key={title} className="overview-card">
            <span className="feature-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p className="muted">{description}</p>
            <span className="card-detail">
              <Check size={15} aria-hidden="true" />
              {detail}
            </span>
          </Card>
        ))}
      </div>
      <Card className="foundation-banner">
        <div>
          <p className="eyebrow">LESS NOISE. MORE CLARITY.</p>
          <h2>A solid foundation for what comes next.</h2>
          <p className="muted">
            Explore working components, appearance options, and interaction
            states.
          </p>
        </div>
        <Link href="/design-system#tokens" className="button button-secondary">
          View foundations <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </Card>
      <footer className="page-footer">
        <span>common. / Built with intention</span>
        <span>Design system · v0.1</span>
      </footer>
    </div>
  );
}
