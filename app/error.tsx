"use client";
import { ErrorState } from "@/components/ui/primitives";
export default function ErrorBoundary({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="page-content">
      <ErrorState onRetry={retry} />
    </div>
  );
}
