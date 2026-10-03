import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useKitchenBoard, type KitchenSource } from "../hooks/use-kitchen-board";
import KitchenBoardView from "./kitchen-board-view";

/** Container of the board: owns the polling, hands the grouped Tickets to the view. */
export default function KitchenBoard({
  source,
  onRejected,
}: {
  source: KitchenSource;
  onRejected?: () => void;
}) {
  const board = useKitchenBoard(source, onRejected);
  if (!board.loaded) {
    return board.failedToLoad ? (
      <LoadError message="No pudimos cargar las comandas. Seguimos intentando." />
    ) : (
      <Loader />
    );
  }
  return (
    <KitchenBoardView
      columns={board.columns}
      metrics={board.metrics}
      connection={board.connection}
      advanceError={board.advanceError}
      onAdvance={(ticketId, status) => void board.advance(ticketId, status)}
    />
  );
}
