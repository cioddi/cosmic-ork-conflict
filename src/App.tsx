import { lazy, Suspense } from "react";
import "./App.css";
import Header from "./components/Header";
import ArmyWorkshop from "./components/ArmyWorkshop";
import { useGame } from "./game/GameContext";

const BattleView = lazy(() => import("./game/view/BattleView"));

function App() {
  const game = useGame();

  return (
    <>
      <Header />
      {game?.game && (
        <Suspense fallback={<div className="battle-view-loading">Loading battle view…</div>}>
          <BattleView />
        </Suspense>
      )}
      <ArmyWorkshop />
    </>
  );
}

export default App;
