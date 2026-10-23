export type ListingView = {
  publicId: string;
  title: string;
  place: string;
  summary: string;
  nightlyPrice: number;
  currency: "CRC";
  hero: { src: string; width: number; height: number; alt: string };
};

export const listingPath = (publicId: string) => `/casa/${publicId}`;
