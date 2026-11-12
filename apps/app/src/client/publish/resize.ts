// Las tres variantes JPEG de una foto, en el navegador y bajo demanda (este módulo solo se carga al elegir fotos).
// De la mayor a la menor, cada una a partir de la anterior: menos trabajo y mejor suavizado que tres veces desde 12 MP.
import type { PhotoVariants } from "../../domain/api";
import { VARIANT_QUALITY, variantTargets } from "../../domain/image";

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("sin imagen"))), "image/jpeg", VARIANT_QUALITY));

export async function makeVariants(file: Blob): Promise<PhotoVariants> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const out: Partial<PhotoVariants> = {};
    let source: CanvasImageSource = bitmap;
    for (const t of variantTargets(bitmap.width, bitmap.height).reverse()) {
      const canvas = document.createElement("canvas");
      canvas.width = t.w;
      canvas.height = t.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sin canvas");
      ctx.fillStyle = "#fff"; // un PNG transparente no queda negro en JPEG
      ctx.fillRect(0, 0, t.w, t.h);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, t.w, t.h);
      out[t.size] = await toJpeg(canvas);
      source = canvas;
    }
    return out as PhotoVariants;
  } finally {
    bitmap.close();
  }
}
