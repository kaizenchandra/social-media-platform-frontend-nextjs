import type { Metadata } from "next";
import { ComponentLibrary } from "@/components/design-system/component-library";
export const metadata: Metadata = { title: "Component library" };
export default function DesignSystemPage() {
  return <ComponentLibrary />;
}
