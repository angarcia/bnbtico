import { NextResponse, type NextRequest } from "next/server";

// pruebas.bnbtico.com pide contraseña (PREVIEW_PASSWORD). Sin variable, no hay barrera (local, producción).
export function proxy(request: NextRequest) {
  const password = process.env.PREVIEW_PASSWORD;
  if (!password) return NextResponse.next();
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="bnbtico pruebas", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-512.png|manifest.webmanifest).*)"] };
