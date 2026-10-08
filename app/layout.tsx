import { WellbeingProvider } from "@/features/advanced/wellbeing-provider";
import type { Metadata } from "next";
import { themeInitScript } from "@/lib/theme/theme";
import {
  ApplicationShell,
  FoundationContext,
} from "@/components/shell/application-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Common — A little more connection",
    template: "%s · Common",
  },
  description:
    "The accessible design foundation for Common, a thoughtful social space.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ApplicationShell context={<FoundationContext />}>
          <WellbeingProvider>{children}</WellbeingProvider>
        </ApplicationShell>
      </body>
    </html>
  );
}
