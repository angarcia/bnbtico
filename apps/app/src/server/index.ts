import { Hono } from "hono";
import { robotsTxt, type Environment } from "../domain/seo";
import { FIXTURE_LISTING } from "../shared/fixture";
import { renderListingDocument } from "./render";

export type Env = {
  ENVIRONMENT: Environment;
  ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
};

const app = new Hono<{ Bindings: Env }>();

app.get("/robots.txt", (c) => c.text(robotsTxt(c.env.ENVIRONMENT)));

app.get("/casa/:publicId", async (c) => {
  if (c.req.param("publicId") !== FIXTURE_LISTING.publicId) return c.env.ASSETS.fetch(c.req.raw);
  const url = new URL(c.req.url);
  const template = await (await c.env.ASSETS.fetch(new URL("/", url))).text();
  return c.html(renderListingDocument(template, FIXTURE_LISTING, url.origin));
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
