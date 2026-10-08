import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { Compass } from "lucide-react";
export default function NotFound() {
  return (
    <div className="page-content">
      <EmptyState
        title="This page isn’t here"
        description="The link may have changed. Return to the overview to find your way."
        icon={<Compass size={28} />}
        action={
          <Link href="/overview" className="button button-primary">
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
