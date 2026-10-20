/**
 * The software lifecycle map, under the names the rest of the site already imports. The engine lives in engine.ts and the
 * definition in software.ts; other maps are listed in maps.ts.
 */
import { MAPS } from "./maps";

export {
  AI_MODES, FAMILY_ORDER, SIZE_LABEL, aiRoleName,
  type AiMode, type FocusId, type Gate, type JourneyView, type LineId, type MapData, type RaceInfo, type RoleInfo, type Route, type StageId, type Station, type Stop, type TrackInfo,
} from "./engine";

export const {
  U, LEFT, TOP, ROW, W, H, px, py,
  LINES, GATES, LINE_BY_ID, LINE_COLOUR, LINE_BLURB, ZONES, zoneOf,
  STATIONS, STATION_BY_ID, GATE_BY_ID, gateRow, gateBottom, SEQ, stationsOn,
  FOCUS, FOCUS_STOPS, FOCUS_START, focusLinesOf, focusForRole,
  STAGES, STAGE_BY_ID,
  AI_STOPS_FULL, AI_STOPS_LITE, AI_REVIEW_STOPS, isTechRole,
  buildRoute, dependenciesOf, nextGateFor,
} = MAPS.software;
