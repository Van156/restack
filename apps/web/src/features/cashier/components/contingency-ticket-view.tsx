import { Button } from "@base-template/ui/components/button";
import {
  ContingencyTicket,
  type ContingencyTicketProps,
} from "@base-template/ui/components/contingency-ticket";

/** The contingency ticket with a print button; printing shows only the ticket. */
export default function ContingencyTicketView({
  ticket,
  onPrint,
}: {
  ticket: ContingencyTicketProps;
  onPrint: () => void;
}) {
  return (
    <section aria-label="Tiquete de contingencia" className="space-y-3">
      <div data-print-area className="w-fit">
        <ContingencyTicket {...ticket} />
      </div>
      <Button type="button" variant="outline" onClick={onPrint}>
        Imprimir tiquete
      </Button>
    </section>
  );
}
