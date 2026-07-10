// top-level router for the whole suite. dead simple on purpose: one bit of
// state says which screen we're on (home / packaging / nutrition) and we render
// that. no react-router — there are only three screens and this keeps it light.
import { useState } from "react";
import HomePage, { type AppView } from "./shared/HomePage";
import PackagingApp from "./packaging/PackagingApp";
import NutritionApp from "./nutrition/NutritionApp";
import CursorGlow from "./shared/CursorGlow";

export default function App() {
  const [view, setView] = useState<AppView>("home");

  const goHome = () => setView("home");

  const screen =
    view === "packaging" ? (
      <PackagingApp onBack={goHome} />
    ) : view === "nutrition" ? (
      <NutritionApp onBack={goHome} />
    ) : (
      <HomePage onSelect={setView} />
    );

  return (
    <>
      <CursorGlow />
      {screen}
    </>
  );
}

