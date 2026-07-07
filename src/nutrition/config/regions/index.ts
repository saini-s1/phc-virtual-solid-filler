import type { RegionConfig } from "../../types/config";
import { US_REGION } from "./us";

// Region registry. v1 ships US only; add a RegionConfig here to support another region
// with no engine changes.
const REGIONS: Record<string, RegionConfig> = {
  US: US_REGION,
};

export function getRegion(id: string): RegionConfig {
  const region = REGIONS[id];
  if (!region) {
    throw new Error(`Unknown region "${id}". Available: ${Object.keys(REGIONS).join(", ")}.`);
  }
  return region;
}

export { US_REGION };
