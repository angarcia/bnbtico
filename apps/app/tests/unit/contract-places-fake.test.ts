import { createFakePlaces } from "../../src/data/fake/places";
import { placesContract } from "../contract/places.contract";

placesContract("fake en memoria", async () => ({ places: createFakePlaces() }));
