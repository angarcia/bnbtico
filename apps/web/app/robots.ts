import type { MetadataRoute } from "next";
import { robotsFor } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsFor({ NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE, NODE_ENV: process.env.NODE_ENV });
}
