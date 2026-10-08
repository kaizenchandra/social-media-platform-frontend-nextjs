"use client";
// Independent document: root-layout failures must not require the failed shell or log private errors.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Common temporarily unavailable</title>
      </head>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: "2rem",
          color: "#172337",
          background: "#f7fafc",
        }}
      >
        <main>
          <h1>Common temporarily unavailable</h1>
          <p>
            The page could not load. Your action has not been confirmed. Reload
            to check its status before submitting again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: ".75rem 1rem", font: "inherit" }}
          >
            Try loading again
          </button>
          <p>
            {/* Root-layout recovery must reload the document without the failed router. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Return home</a>
          </p>
        </main>
      </body>
    </html>
  );
}
