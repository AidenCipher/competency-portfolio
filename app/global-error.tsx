"use client";

// Last-resort boundary: replaces the root layout, so it carries its own <html> and minimal inline styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f6f7fb", color: "#0b0d14" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.25rem" }}>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.1 }}>Something went wrong</h1>
          <p style={{ color: "#4a5068" }}>The app couldn&apos;t load. Your saved work is safe. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#2547ff", color: "#fff", border: 0, borderRadius: 999, padding: "0.75rem 1.25rem", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
