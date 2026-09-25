import raw from "../../data/resorts.json";
import { datasetSchema, type City, type Dataset, type Pass, type Resort } from "./schema";

export const dataset: Dataset = datasetSchema.parse(raw);
export const passes: Pass[] = dataset.passes;
export const resorts: Resort[] = dataset.resorts;
export const cities: City[] = dataset.cities;

export const passById = new Map(passes.map((pass) => [pass.id, pass]));
export const resortById = new Map(resorts.map((resort) => [resort.id, resort]));
