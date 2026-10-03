import { dianDocumentsRouter } from "./dian-documents";
import { dianOutboxRouter } from "./dian-outbox";
import { dianSetupRouter } from "./dian-setup";

/** DIAN: choice, connection and habilitación, document issuing, outbox, incidents and counts. */
export const dianRouter = {
  ...dianSetupRouter,
  ...dianDocumentsRouter,
  ...dianOutboxRouter,
};
