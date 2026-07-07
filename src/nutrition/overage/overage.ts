// OH-234 overage — its own module, isolated from rounding and region config.
// Declare-down (FLAG 3): we formulate high and declare low.
//   asDeclared = asFormulated ÷ (1 + overageFrac)
// There is NO default for overageFrac. A missing value is caught by preflight
// (OVERAGE_MISSING) and never substituted here.

export function applyOverage(asFormulated: number, overageFrac: number): number {
  return asFormulated / (1 + overageFrac);
}
