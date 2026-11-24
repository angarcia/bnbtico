// Regenera las capturas de referencia de las e2e (toHaveScreenshot) con el navegador de Linux que usa CI: Playwright corre
// aquí y el navegador en la imagen oficial de Docker de la misma versión (`playwright run-server`), así que la captura es
// la que verá CI. Uso, con `pnpm build` hecho y Docker abierto:  pnpm capturas:actualizar
// Para solo comparar, sin regenerar:  pnpm capturas:actualizar --comparar
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).devDependencies["@playwright/test"];
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const port = 3456;
const name = "3bstays-capturas";

execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
const server = spawn("docker", ["run", "--rm", "--name", name, "-p", `${port}:${port}`, "--add-host=hostmachine:host-gateway", "--init", "--workdir", "/home/pwuser", "--user", "pwuser", image,
  "/bin/sh", "-c", `npx -y playwright@${version} run-server --port ${port} --host 0.0.0.0`], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes("Listening") && resolve(undefined));
  server.on("exit", (code) => reject(new Error(`El servidor de Docker terminó (${code}).`)));
});
let status = 1;
try {
  const args = ["exec", "playwright", "test", "tests/e2e/componentes.spec.ts", "-g", "captura de referencia", ...(process.argv.includes("--comparar") ? [] : ["--update-snapshots"])];
  const run = spawn("pnpm", args, { stdio: "inherit", env: { ...process.env, PW_LINUX_WS: `ws://127.0.0.1:${port}/` } });
  status = await new Promise((resolve) => run.on("exit", (code) => resolve(code ?? 1)));
} finally {
  execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
}
process.exit(status);
