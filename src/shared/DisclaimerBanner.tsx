// the amber "this is only a prototype" strip. drop <DisclaimerBanner /> under a
// header whenever you want the warning visible. shared between both modules.
import { AlertTriangle } from "lucide-react";

export default function DisclaimerBanner() {
  return (
    <div
      role="alert"
      className="border-y border-amber-200 bg-amber-50/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1400px] items-start gap-3 px-6 py-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-amber-900 md:text-sm">
          <span className="font-semibold">Prototype only.</span> Predictions
          shown are surrogate-model mock outputs for workflow demonstration.
          Replace with trained DEM coefficients before any technical use.
        </p>
      </div>
    </div>
  );
}
