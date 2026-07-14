// module 01 dashboard — the packaging / dem side of the app.
// this file is mostly wiring: it holds the current scenario (which gummy, which
// bottle, how many), asks the model for a prediction, and lays out the three
// panels + the comparison chart. no math lives here — that's all in model/.
// >>> want to move panels around or change the page layout? edit this file. <<<
import { useMemo, useState } from "react";
import Header from "../shared/Header";
import InputPanel, {
  resolveGummy,
  type ScenarioState,
} from "./components/InputPanel";
import BottleVisualizer from "./components/BottleVisualizer";
import OutputPanel from "./components/OutputPanel";
import ComparisonChart from "./components/ComparisonChart";
import SurrogateExplainer from "./components/SurrogateExplainer";

import { getGummyById } from "./data/productPresets";
import {
  getBottleById,
  makeCustomBottle,
  CUSTOM_BOTTLE_ID,
} from "./data/bottlePresets";
import {
  predictFill,
  recommendCountForTarget,
  type PredictionInputs,
} from "./model/surrogateModel";

const DEFAULT_STATE: ScenarioState = {
  gummyId: "dory",
  bottleId: "r-500cc",
  count: 90,
};

type Props = {
  onBack: () => void;
};

// the packaging dashboard. lifted out of App.tsx so it can sit behind the
// module-picker landing page. holds all the scenario state for this module.
export default function PackagingApp({ onBack }: Props) {
  const [state, setState] = useState<ScenarioState>(DEFAULT_STATE);
  const [runId, setRunId] = useState(0);

  const gummy = getGummyById(state.gummyId);
  const bottle =
    state.bottleId === CUSTOM_BOTTLE_ID
      ? makeCustomBottle(
          state.customBottle?.volumeMl ?? 500,
          state.customBottle?.shape ?? "round"
        )
      : getBottleById(state.bottleId);

  // Resolve effective gummy geometry (custom overrides win) and assemble inputs.
  const inputs = useMemo<PredictionInputs>(() => {
    const g = resolveGummy(state, gummy);
    return {
      bottleVolumeMl: bottle.volumeMl,
      shoulderHeightMm: bottle.shoulderHeightMm,
      neckHeightMm: bottle.neckHeightMm,
      bodyWidthMm: bottle.bodyWidthMm,
      bodyDepthMm: bottle.bodyDepthMm,
      cornerRadiusMm: bottle.cornerRadiusMm,
      bottleShape: bottle.shape,
      family: gummy.family,
      radiusTopMm: g.radiusTopMm,
      radiusBottomMm: g.radiusBottomMm,
      heightMm: g.heightMm,
      densityGPerMl: g.densityGPerMl,
      weightG: g.weightG,
      count: state.count,
    };
  }, [bottle, gummy, state]);

  const result = useMemo(() => predictFill(inputs), [inputs]);

  const handleRun = () => {
    const { count: recCount } = recommendCountForTarget(inputs);
    setState((prev) =>
      prev.count === recCount ? prev : { ...prev, count: recCount }
    );
    setRunId((n) => n + 1);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        moduleTag="MODULE_01"
        title="PHC Virtual Solid Filler"
        subtitle="Solid-fill prediction for gummy packaging"
        onBack={onBack}
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        {/* Hero row: input · bottle · output */}
        <div className="grid gap-5 lg:grid-cols-[340px_1fr_360px]">
          <div className="animate-fade-up [animation-delay:40ms]">
            <InputPanel
              state={state}
              gummy={gummy}
              onChange={setState}
              onRun={handleRun}
            />
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <BottleVisualizer
              bottle={bottle}
              result={result}
              count={state.count}
              runId={runId}
            />
          </div>
          <div className="animate-fade-up [animation-delay:200ms]">
            <OutputPanel result={result} />
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          <div className="animate-fade-up [animation-delay:280ms]">
            <ComparisonChart gummy={gummy} bottle={bottle} count={state.count} />
          </div>

          <div className="animate-fade-up [animation-delay:360ms]">
            <SurrogateExplainer />
          </div>

        </div>
      </main>

      <footer className="border-t border-ink-100 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-6 py-3 text-[11px] text-ink-400">
          <p className="font-mono">
            DEM-validated surrogate model · prototype interface
          </p>
        </div>
      </footer>
    </div>
  );
}
