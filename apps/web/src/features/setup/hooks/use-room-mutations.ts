import { client } from "@/app/orpc";

import { useSetupMutation } from "./use-setup-mutation";

const { areas, tables, stations } = client.restaurant;

/** Writes of the Áreas, Mesas and Estaciones steps. */
export function useRoomMutations() {
  return {
    createArea: useSetupMutation(areas.create, "Área creada"),
    renameArea: useSetupMutation(areas.update, "Área renombrada"),
    deleteArea: useSetupMutation(areas.delete, "Área eliminada"),
    bulkCreateTables: useSetupMutation(tables.bulkCreate, "Mesas creadas"),
    updateTable: useSetupMutation(tables.update, "Mesa actualizada"),
    deleteTable: useSetupMutation(tables.delete, "Mesa eliminada"),
    createStation: useSetupMutation(stations.create, "Estación creada"),
    renameStation: useSetupMutation(stations.update, "Estación renombrada"),
    deleteStation: useSetupMutation(stations.delete, "Estación eliminada"),
  };
}
