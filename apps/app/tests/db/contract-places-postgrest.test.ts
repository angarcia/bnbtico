import { createPostgrestPlaces } from "../../src/data/postgrest/places";
import { placesContract } from "../contract/places.contract";
import { anonClient } from "./local";

placesContract("PostgREST (Supabase local)", async () => ({ places: createPostgrestPlaces(anonClient()) }));
