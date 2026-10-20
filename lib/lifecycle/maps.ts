import { buildModel, type MapModel } from "./engine";
import { BUSINESS_DEF } from "./business";
import { PUBLIC_DEF } from "./public";
import { SOFTWARE_DEF } from "./software";

/** Every map the site offers. Add a map by writing a MapDef and listing it here. */
export const MAPS: Record<string, MapModel> = {
  business: buildModel(BUSINESS_DEF),
  public: buildModel(PUBLIC_DEF),
  software: buildModel(SOFTWARE_DEF),
};
export type MapId = keyof typeof MAPS;
/** The map at /map itself. Every other map lives at /map/<id>. */
export const DEFAULT_MAP = "business";
/** The maps in the switcher, in order, with where each lives. */
export const MAP_LIST = Object.values(MAPS).map((m) => ({ id: m.id, label: m.label, href: m.id === DEFAULT_MAP ? "/map" : `/map/${m.id}` }));
export const mapFor = (id: string | null | undefined): MapModel | null => (id && Object.hasOwn(MAPS, id) ? MAPS[id] : null);
