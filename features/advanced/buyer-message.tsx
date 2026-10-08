"use client";
import Link from "next/link";
import { useState } from "react";
import { Textarea } from "@/components/ui/forms";
import type { ListingView } from "./contracts";
export function BuyerMessage({ item }: { item: ListingView }) {
  const [text, setText] = useState("");
  return (
    <section className="card">
      <h1>Buyer message draft</h1>
      <p>
        About {item.title} · to {item.seller.displayName}
      </p>
      <p>
        Seller messaging service unavailable. This text stays in the document;
        no message, conversation, delivery receipt or E2EE session is created.
      </p>
      <Textarea
        label="Unsent buyer message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1200}
      />
      <button className="button button-secondary" type="button" disabled>
        Send unavailable
      </button>
      <p>
        <Link href={`/marketplace/${item.id}`}>Back to listing</Link> ·{" "}
        <Link href="/messages">Open synthetic messaging preview</Link>
      </p>
    </section>
  );
}
