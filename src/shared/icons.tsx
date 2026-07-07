// small icon shim — re-exports a couple of lucide icons and adds a custom
// bottle icon (lucide doesn't ship one). add any one-off svg icons here.
import type { SVGProps } from "react";
export { BarChart3, Boxes } from "lucide-react";

export function Bottle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 2h4v3l1.2 2.4A4 4 0 0 1 16 9.2V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9.2a4 4 0 0 1 .8-1.8L10 5z" />
      <path d="M9 12h6" />
    </svg>
  );
}
