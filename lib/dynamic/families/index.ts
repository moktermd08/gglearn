import type { Family } from "../types";
import { jsFamilies } from "./js";
import { pyFamilies } from "./py";
import { phpFamilies } from "./php";
import { sqlFamilies } from "./sql";
import { cssFamilies } from "./css";
import { htmlFamilies } from "./html";
import { dataFamilies } from "./data";
import { gitFamilies } from "./git";
import { opsFamilies } from "./ops";
import { webFamilies } from "./web";
import { frameworkFamilies } from "./frameworks";
import { langFamilies } from "./lang";
import { bizFamilies } from "./biz";

export const FAMILIES: Family[] = [...jsFamilies, ...pyFamilies, ...phpFamilies, ...sqlFamilies, ...cssFamilies, ...htmlFamilies, ...dataFamilies, ...gitFamilies, ...opsFamilies, ...webFamilies, ...frameworkFamilies, ...langFamilies, ...bizFamilies];
