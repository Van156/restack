import { Badge } from "@base-template/ui/components/badge";
import {
  statusLabel,
  statusTone,
  type StatusKind,
  type StatusOf,
} from "@base-template/ui/lib/status-labels";

type StatusBadgeProps<K extends StatusKind> = {
  kind: K;
  status: StatusOf<K>;
  className?: string;
};

/** Badge for a Ticket, Table session, document or sync status, labelled in Spanish. */
function StatusBadge<K extends StatusKind>({ kind, status, className }: StatusBadgeProps<K>) {
  return (
    <Badge variant={statusTone(kind, status)} className={className} data-status={status}>
      {statusLabel(kind, status)}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps };
