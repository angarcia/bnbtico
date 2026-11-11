import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { initializeRun, sanitizeRun } from "../../scripts/sanitize-playwright-artifacts.mjs";

const require = createRequire(import.meta.url);
const yauzl = require("yauzl");
const yazl = require("yazl");
const script = new URL("../../scripts/sanitize-playwright-artifacts.mjs", import.meta.url).pathname;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let folder: string;
let root: string;

async function zip(entries: Record<string, Buffer>, compress = true): Promise<Buffer> {
  const file = new yazl.ZipFile();
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((done, fail) => {
    file.on("error", fail);
    file.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    file.outputStream.on("error", fail);
    file.outputStream.on("end", () => done(Buffer.concat(chunks)));
  });
  for (const [name, data] of Object.entries(entries)) file.addBuffer(data, name, { compress, mtime: new Date("2026-01-02T03:04:06Z") });
  file.end();
  return finished;
}

async function unzip(data: Buffer): Promise<Map<string, Buffer>> {
  const file = await yauzl.fromBufferPromise(data);
  const entries = new Map<string, Buffer>();
  try {
    for await (const entry of file.eachEntry()) {
      if (entry.fileName.endsWith("/")) continue;
      const stream = await file.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      entries.set(entry.fileName, Buffer.concat(chunks));
    }
    return entries;
  } finally {
    file.close();
  }
}

async function inspect(data: Buffer, canaries: string[]): Promise<void> {
  for (const value of canaries) {
    for (const encoded of [value, encodeURIComponent(value), Buffer.from(value).toString("base64")]) {
      expect(data.includes(Buffer.from(encoded)), "un canario llegó al artefacto publicable").toBe(false);
    }
  }
  if (data.subarray(0, 2).toString() === "PK") {
    for (const child of (await unzip(data)).values()) await inspect(child, canaries);
  } else {
    for (const match of data.toString().matchAll(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/g)) {
      await inspect(Buffer.from(match[1]!, "base64"), canaries);
    }
  }
}

async function inspectDirectory(path: string, canaries: string[]) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await inspectDirectory(file, canaries);
    else await inspect(await readFile(file), canaries);
  }
}

async function consoleArtifact(format: string, text: string | string[], buffer?: string, stream = "stdout") {
  const binary = format.endsWith("buffer");
  const texts = typeof text === "string" ? [text] : text;
  const chunks = texts.map(text => binary ? { buffer: buffer ?? Buffer.from(text).toString("base64") } : { text });
  if (format.startsWith("json")) {
    return { name: "runner.json", bytes: Buffer.from(JSON.stringify({
      config: { version: "1.64.1", projects: [] }, errors: [],
      stats: { expected: 0, unexpected: 1, skipped: 0, flaky: 0, duration: 42 },
      suites: [{ title: "fixture.spec.cjs", specs: [{ id: "test-1", tests: [{
        expectedStatus: "passed", status: "unexpected", results: [{
          status: "failed", duration: 42, retry: 0, stdout: stream === "stdout" ? chunks : [], stderr: stream === "stderr" ? chunks : [],
          error: { message: "Error sintético\nconst value = { example: true };", snippet: "1 | fn({ example: true })", stack: "at fn ({file}:1)" },
        }],
      }] }] }],
    })) };
  }
  if (format.startsWith("blob")) {
    const events = [
      { method: "onBlobReportMetadata", params: { version: 2 } },
      ...chunks.map((chunk, i) => ({ method: "onStdIO", params: { type: stream, testId: "test-1", resultId: "result-1", data: binary ? chunk.buffer : texts[i], isBase64: binary } })),
      { method: "onTestEnd", params: { test: { testId: "test-1", expectedStatus: "passed" }, result: { id: "result-1", status: "failed", duration: 42, retry: 0 } } },
    ];
    return { name: "report.zip", bytes: await zip({ "report.jsonl": Buffer.from(events.map(e => JSON.stringify(e)).join("\n")) }) };
  }
  const events = texts.map((text, i) => format === "trace-console"
    ? { type: "console", messageType: "log", text, args: [{ preview: text, value: text }], location: { url: "http://127.0.0.1/", lineNumber: 1, columnNumber: 1 }, time: 1, pageId: "page-1" }
    : { type: stream, timestamp: i + 1, ...(binary ? { base64: chunks[i]!.buffer } : { text }) });
  return { name: "test.trace", bytes: Buffer.from([
    { type: "context-options", version: 10, origin: "testRunner" }, ...events,
  ].map(e => JSON.stringify(e)).join("\n")) };
}

async function consoleContents(format: string, bytes: Buffer): Promise<string[]> {
  if (format.startsWith("json")) {
    const report = JSON.parse(bytes.toString());
    const result = report.suites[0].specs[0].tests[0].results[0];
    expect(result.status).toBe("failed");
    expect(result.duration).toBe(42);
    expect(result.retry).toBe(0);
    expect(result.error).toEqual({ message: "Error sintético\nconst value = { example: true };", snippet: "1 | fn({ example: true })", stack: "at fn ({file}:1)" });
    return [...result.stdout, ...result.stderr].map(chunk => chunk.text ?? Buffer.from(chunk.buffer, "base64").toString());
  }
  if (format.startsWith("blob")) {
    const events = (await unzip(bytes)).get("report.jsonl")!.toString().split("\n").filter(Boolean).map(line => JSON.parse(line));
    expect(events.find(event => event.method === "onTestEnd").params.result).toEqual({ id: "result-1", status: "failed", duration: 42, retry: 0 });
    return events.filter(event => event.method === "onStdIO").map(event => event.params.isBase64 ? Buffer.from(event.params.data, "base64").toString() : event.params.data);
  }
  return bytes.toString().split("\n").filter(Boolean).map(line => JSON.parse(line))
    .filter(event => ["console", "stdout", "stderr"].includes(event.type))
    .flatMap(event => event.type === "console" ? [event.text, ...event.args.flatMap((arg: { preview: string; value: string }) => [arg.preview, arg.value])] : [event.text ?? Buffer.from(event.base64, "base64").toString()]);
}

async function command(file: string, args: string[], cwd = folder, env: NodeJS.ProcessEnv = process.env) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((done) => {
    execFile(file, args, { cwd, env, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) =>
      done({ code: error ? Number(error.code) || 1 : 0, stdout, stderr }));
  });
}

async function listen(server: Server) {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto local.");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done()));
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "3bstays-artifacts-test-"));
  root = join(folder, "run");
  await initializeRun(root);
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("artefactos Playwright publicables", () => {
  it("crea una zona privada nueva y rechaza reutilizarla o leer un directorio sin marcador", async () => {
    expect((await stat(root)).mode & 0o077).toBe(0);
    expect((await stat(join(root, "raw"))).mode & 0o077).toBe(0);
    await expect(initializeRun(root)).rejects.toThrow();
    await expect(sanitizeRun({ root: folder })).rejects.toThrow();
    await expect(initializeRun(join(process.cwd(), "no-es-temporal"))).rejects.toThrow();
  });

  it("sanea JSON normalizado, strings serializados, copias codificadas y errores sin cambiar estados o tiempos", async () => {
    const access = `ACCESS_${randomUUID()}`;
    const refresh = `REFRESH_${randomUUID()}`;
    const cookie = `COOKIE_${randomUUID()}`;
    const key = `API_${randomUUID()}`;
    const raw = {
      status: "failed", expected: 2, unexpected: 1, duration: 1234.5, retries: 0,
      storageState: { cookies: [{ name: "session", value: cookie }], origins: [{ origin: "http://127.0.0.1:1234", localStorage: [{ name: "3bstays-auth", value: JSON.stringify({ access_token: access, refresh_token: refresh }) }] }] },
      headers: [{ name: "Authorization", value: `Bearer ${access}` }, { name: "apikey", value: key }],
      error: { message: `Falló la consulta: ${access}`, stack: `Error: ${refresh}\n at prueba.ts:3:4` },
      encoded: Buffer.from(JSON.stringify({ refresh_token: refresh })).toString("base64"),
      uri: encodeURIComponent(JSON.stringify({ access_token: access })),
      copy: `${cookie} ${key}`,
    };
    await writeFile(join(root, "raw", "e2e-normalized.json"), JSON.stringify(raw));
    await sanitizeRun({ root });
    const output = JSON.parse(await readFile(join(root, "publish", "e2e-normalized.json"), "utf8"));
    expect(output).toMatchObject({ status: "failed", expected: 2, unexpected: 1, duration: 1234.5, retries: 0 });
    expect(output.error.message).toContain("Falló la consulta:");
    expect(output.error.stack).toContain("at prueba.ts:3:4");
    await inspectDirectory(join(root, "publish"), [access, refresh, cookie, key]);
  });

  it("procesa ZIP anidados y HTML base64, conserva las imágenes y aprende secretos antes de limpiar sus copias", async () => {
    const secret = `CANARY_${randomUUID()}`;
    const trace = await zip({
      "0.trace": Buffer.from(JSON.stringify({ type: "context-options", version: 10, wallTime: 123, options: { storageState: { access_token: secret } } }) + "\n"),
      "resources/pixel.png": png,
      "resources/body.json": Buffer.from(JSON.stringify({ refresh_token: secret })),
    });
    const blob = await zip({ "report.jsonl": Buffer.from(JSON.stringify({ method: "onEnd", params: { result: { status: "failed", duration: 22 } } }) + "\n"), "resources/trace.zip": trace });
    const html = `<html><body>Informe<template id="playwrightReportBase64">data:application/zip;base64,${blob.toString("base64")}</template></body></html>`;
    await writeFile(join(root, "raw", "a-error.txt"), `Error conservado ${secret}`);
    await writeFile(join(root, "raw", "report.html"), html);
    await sanitizeRun({ root });
    const safe = await readFile(join(root, "publish", "report.html"), "utf8");
    const nested = await unzip(Buffer.from(safe.match(/base64,([^<]+)/)![1]!, "base64"));
    const traceEntries = await unzip(nested.get("resources/trace.zip")!);
    expect(traceEntries.get("resources/pixel.png")).toEqual(png);
    expect(JSON.parse(traceEntries.get("0.trace")!.toString())).toMatchObject({ type: "context-options", version: 10, wallTime: 123 });
    await inspectDirectory(join(root, "publish"), [secret]);
  });

  it.each([false, true])("P1: sanea base64 doble en ambas pasadas, con secreto previo: %s", async (known) => {
    const secret = `WRAPPED_${randomUUID()}`;
    const payload = { access_token: secret, status: "failed", duration: 42 };
    const wrap = (value: string) => Buffer.from(value).toString("base64");
    const wrapped = wrap(wrap(JSON.stringify(payload)));
    if (known) await writeFile(join(root, "raw", "session.json"), JSON.stringify({ access_token: secret }));
    await writeFile(join(root, "raw", "report.json"), JSON.stringify({ error: wrapped }));
    await writeFile(join(root, "raw", "wrapper.txt"), wrapped);
    await sanitizeRun({ root, output: "clean" });
    const check = async (dir: string) => {
      const report = JSON.parse(await readFile(join(root, dir, "report.json"), "utf8"));
      for (const value of [report.error, await readFile(join(root, dir, "wrapper.txt"), "utf8")]) {
        const decoded = JSON.parse(Buffer.from(Buffer.from(value, "base64").toString(), "base64").toString());
        expect(decoded.access_token === secret, "un canario sobrevivió dos envolturas").toBe(false);
        expect(decoded.access_token === "[REDACTED]").toBe(true);
        expect(decoded.status).toBe("failed");
        expect(decoded.duration).toBe(42);
      }
      await inspectDirectory(join(root, dir), [secret]);
    };
    await check("clean");
    await writeFile(join(root, "render", "report.json"), JSON.stringify({ error: wrapped }));
    await writeFile(join(root, "render", "wrapper.txt"), wrapped);
    await writeFile(join(root, "render", "from-clean.json"), await readFile(join(root, "clean", "report.json")));
    await sanitizeRun({ root, input: "render" });
    await check("publish");
  });

  it.each(["Authorization", "Proxy-Authorization", "pRoXy-AuThOrIzAtIoN"])("P1: reconoce %s Basic solo en runner.log y elimina sus copias", async (name) => {
    const password = `BASIC_${randomUUID()}`;
    const decoded = `synthetic-user:${password}`;
    const credential = Buffer.from(decoded).toString("base64");
    const log = `Error sintético\n${name}: bAsIc\t${credential}\nCopia: ${credential}\nDecodificada: ${decoded}\n`;
    await writeFile(join(root, "raw", "runner.log"), log);
    await sanitizeRun({ root, output: "clean" });
    const check = async (dir: string) => {
      const output = await readFile(join(root, dir, "runner.log"), "utf8");
      expect(output.includes(password) || output.includes(credential) || output.includes(decoded), "credencial Basic publicable").toBe(false);
      expect(output).toContain("Error sintético");
      await inspectDirectory(join(root, dir), [password, credential]);
    };
    await check("clean");
    await writeFile(join(root, "render", "runner.log"), log);
    await sanitizeRun({ root, input: "render" });
    await check("publish");
  });

  it.each(["raw", "render"] as const)("P1: rechaza envolturas profundas en %s, aunque sus prefijos estén en caché", async (input) => {
    await writeFile(join(root, "raw", "report.json"), '{"status":"failed","duration":42}');
    if (input === "render") await sanitizeRun({ root, output: "clean" });
    let wrapper = JSON.stringify({ access_token: `DEEP_${randomUUID()}` });
    const prefixes = [];
    for (let i = 0; i < 10; i++) {
      wrapper = Buffer.from(wrapper).toString("base64");
      prefixes.push(wrapper);
    }
    await writeFile(join(root, input, "a-prefixes.json"), JSON.stringify(prefixes));
    await writeFile(join(root, input, "z-wrapper.txt"), wrapper);
    await expect(sanitizeRun({ root, input, output: input === "raw" ? "clean" : "publish" })).rejects.toThrow("limits");
    expect(await readdir(root)).not.toContain("publish");
    if (input === "raw") expect(await readdir(root)).not.toContain("clean");
  });

  it.each(["[WebServer]", "Worker:"])("logs: conserva %s como texto y sanea credenciales en ambas pasadas", async (prefix) => {
    const bearer = `BEARER_${randomUUID()}`;
    const password = `PASSWORD_${randomUUID()}`;
    const basic = Buffer.from(`synthetic-user:${password}`).toString("base64");
    const log = `${prefix} listo\nAuthorization: Bearer ${bearer}\nProxy-Authorization: Basic ${basic}\nConsola:\nestado sintético\n2 casos sintéticos, 42 ms\n`;
    await writeFile(join(root, "raw", "runner.log"), log);
    await sanitizeRun({ root, output: "clean" });
    const check = async (dir: string) => {
      const safe = await readFile(join(root, dir, "runner.log"), "utf8");
      expect(safe.startsWith(`${prefix} listo\n`)).toBe(true);
      expect(safe).toContain("Consola:\nestado sintético\n2 casos sintéticos, 42 ms\n");
      await inspectDirectory(join(root, dir), [bearer, password, basic]);
    };
    await check("clean");
    await writeFile(join(root, "render", "runner.log"), log);
    await sanitizeRun({ root, input: "render" });
    await check("publish");
  });

  it("logs: sigue saneando campos estructurados cuando runner.log contiene JSON válido", async () => {
    const password = `PASSWORD_${randomUUID()}`;
    const cookie = `COOKIE_${randomUUID()}`;
    await writeFile(join(root, "raw", "runner.log"), JSON.stringify({
      password, cookies: [{ name: "session", value: cookie }], status: "failed", duration: 42,
    }));
    await sanitizeRun({ root });
    const output = JSON.parse(await readFile(join(root, "publish", "runner.log"), "utf8"));
    expect(output.password === "[REDACTED]").toBe(true);
    expect(output.cookies.length).toBe(0);
    expect(output.status).toBe("failed");
    expect(output.duration).toBe(42);
    await inspectDirectory(join(root, "publish"), [password, cookie]);
  });

  it.each(
    ["wrapped", "password"].flatMap(kind =>
      ["line", "prefix", "multiline", "osc"].flatMap(shape =>
        (["clean", "publish", "render"] as const).map(stage => ({ kind, shape, stage })))),
  )("mixtos: rechaza $kind/$shape antes de $stage", async ({ kind, shape, stage }) => {
    const secret = `MIXED_${randomUUID()}`;
    const wrap = (value: string) => Buffer.from(value).toString("base64");
    const value = kind === "wrapped" ? { error: wrap(wrap(JSON.stringify({ access_token: secret }))) } : { password: secret };
    await writeFile(join(root, "raw", "session.json"), JSON.stringify(kind === "wrapped" ? { access_token: secret } : { status: "failed" }));
    if (stage === "render") await sanitizeRun({ root, output: "clean" });
    const log = (shape === "prefix" ? "[WebServer] " : shape === "osc" ? "\u001b]0;" : "")
      + JSON.stringify(value, null, shape === "multiline" ? 2 : undefined)
      + (shape === "osc" ? "\u0007" : "") + "\n[WebServer] listo\n";
    await writeFile(join(root, stage === "render" ? "render" : "raw", "runner.log"), log);
    await expect(sanitizeRun({
      root, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish",
    })).rejects.toThrow("(json)");
    expect(await readdir(root)).not.toContain("publish");
    if (stage === "clean") expect(await readdir(root)).not.toContain("clean");
    expect((await readdir(root)).some(name => name.startsWith(".stage-"))).toBe(false);
  });

  it.each(["[1/2] listo", "[unknown] listo", '[password: "valor sintético"]', "Consola:\n{estado: 'sintético'}", '[1, [], "valor sintético"]\n[WebServer] listo'])("mixtos: rechaza estructura ambigua %s", async (log) => {
    await writeFile(join(root, "raw", "runner.log"), log);
    await expect(sanitizeRun({ root })).rejects.toThrow("(json)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it("mixtos: conserva controles VT en texto sin confundirlos con arrays", async () => {
    const log = '[WebServer] \u001b[33maviso "sintético"\u001b[0m\n';
    await writeFile(join(root, "raw", "runner.log"), log);
    await sanitizeRun({ root });
    expect(await readFile(join(root, "publish", "runner.log"), "utf8")).toBe(log);
  });

  it.each(["report.json", "calls.stacks", "bundle.map", "0.trace", "0.network", "report.jsonl"])("logs: no degrada JSON inválido a texto en %s", async (name) => {
    for (const content of ['{"status":', "[WebServer] listo"]) {
      await writeFile(join(root, "raw", name), content);
      await expect(sanitizeRun({ root })).rejects.toThrow("(json)");
      expect(await readdir(root)).not.toContain("publish");
      expect((await readdir(root)).some(name => name.startsWith(".stage-"))).toBe(false);
    }
  });

  it.each(
    ["json-text", "json-buffer", "blob-text", "blob-buffer", "trace-text", "trace-buffer", "trace-console"].flatMap(format =>
      ["password", "wrapped"].flatMap(kind =>
        (["clean", "publish", "render"] as const).flatMap(stage =>
          ["", "[WebServer] ", "Worker: "].map(prefix => ({ format, kind, stage, prefix }))))),
  )("consola: rechaza mezcla $format/$kind/$stage/$prefix", async ({ format, kind, stage, prefix }) => {
    const secret = `CONSOLE_${randomUUID()}`;
    const wrap = (s: string) => Buffer.from(s).toString("base64");
    await writeFile(join(root, "raw", "session.json"), JSON.stringify(kind === "wrapped" ? { access_token: secret } : { status: "failed" }));
    if (stage === "render") await sanitizeRun({ root, output: "clean" });
    const payload = kind === "password" ? { password: secret } : { error: wrap(wrap(JSON.stringify({ access_token: secret }))) };
    const artifact = await consoleArtifact(format, prefix + JSON.stringify(payload) + "\n[WebServer] listo");
    await writeFile(join(root, stage === "render" ? "render" : "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish" })).rejects.toThrow("(json)");
    expect(await readdir(root)).not.toContain("publish");
    if (stage === "clean") expect(await readdir(root)).not.toContain("clean");
    expect((await readdir(root)).some(name => name.startsWith(".stage-"))).toBe(false);
  });

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer", "trace-text", "trace-buffer", "trace-console"].flatMap(format => ["json", "auth"].map(mode => ({ format, mode }))))("consola: sanea $mode y conserva diagnósticos en $format", async ({ format, mode }) => {
    const secret = `CONSOLE_${randomUUID()}`;
    const wrap = (s: string) => Buffer.from(s).toString("base64");
    const text = mode === "json"
      ? JSON.stringify({ password: secret, error: wrap(wrap(JSON.stringify({ access_token: secret }))), status: "failed", duration: 42 })
      : `[WebServer] listo\nAuthorization: Bearer ${secret}\nProxy-Authorization: Basic ${wrap(`user:${secret}`)}`;
    const artifact = await consoleArtifact(format, text);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await sanitizeRun({ root, output: "clean" });
    await inspectDirectory(join(root, "clean"), [secret]);
    await writeFile(join(root, "render", artifact.name), artifact.bytes);
    await sanitizeRun({ root, input: "render" });
    await inspectDirectory(join(root, "publish"), [secret]);
    for (const dir of ["clean", "publish"]) {
      for (const content of await consoleContents(format, await readFile(join(root, dir, artifact.name)))) {
        expect(content.includes(secret)).toBe(false);
        if (mode === "json") {
          const value = JSON.parse(content);
          expect(value.password === "[REDACTED]").toBe(true);
          const nested = JSON.parse(Buffer.from(Buffer.from(value.error, "base64").toString(), "base64").toString());
          expect(nested.access_token === "[REDACTED]").toBe(true);
          expect(value.status).toBe("failed");
          expect(value.duration).toBe(42);
        } else {
          expect(content.includes("user:")).toBe(false);
          expect(content.includes(wrap(`user:${secret}`))).toBe(false);
          expect(content.startsWith("[WebServer] listo")).toBe(true);
        }
      }
    }
  });

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer", "trace-text", "trace-buffer", "trace-console"].flatMap(format =>
    (["clean", "publish", "render"] as const).map(stage => ({ format, stage })),
  ))("fragmentos: bloquea secreto conocido $format/$stage", async ({ format, stage }) => {
    const secret = `FRAGMENT_é_${randomUUID()}`;
    await writeFile(join(root, "raw", "session.json"), JSON.stringify({ access_token: secret }));
    if (stage === "render") await sanitizeRun({ root, output: "clean" });
    const split = Math.floor(secret.length / 2);
    const artifact = await consoleArtifact(format, [secret.slice(0, split), secret.slice(split)]);
    await writeFile(join(root, stage === "render" ? "render" : "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish" })).rejects.toThrow("verification");
    expect(await readdir(root)).not.toContain("publish");
    if (stage === "clean") expect(await readdir(root)).not.toContain("clean");
  });

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer", "trace-text", "trace-buffer", "trace-console"])("fragmentos: aprende Basic agregado en %s", async (format) => {
    const password = `BASIC_${randomUUID()}`;
    const credentials = Buffer.from(`user:${password}`).toString("base64");
    const artifact = await consoleArtifact(format, ["Authorization: Basic ", credentials]);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await writeFile(join(root, "raw", "copy.txt"), `Copia ${password}`);
    await sanitizeRun({ root, output: "clean" });
    await writeFile(join(root, "render", artifact.name), artifact.bytes);
    await writeFile(join(root, "render", "copy.txt"), `Copia ${password}`);
    await sanitizeRun({ root, input: "render" });
    for (const dir of ["clean", "publish"]) {
      const text = (await consoleContents(format, await readFile(join(root, dir, artifact.name)))).join("");
      expect(text.includes(credentials)).toBe(false);
      expect(text.includes(password)).toBe(false);
      await inspectDirectory(join(root, dir), [password, credentials]);
    }
  });

  it.each(["json-channel", "json-result", "blob-channel", "blob-test", "blob-result", "trace-channel", "trace-page", "trace-type"])("fragmentos: no mezcla identidades %s", async (scope) => {
    const secret = `ISOLATED_${randomUUID()}`, cut = Math.floor(secret.length / 2);
    await writeFile(join(root, "raw", "session.json"), JSON.stringify({ access_token: secret }));
    const format = scope.startsWith("json") ? "json-text" : scope.startsWith("blob") ? "blob-text" : scope === "trace-channel" ? "trace-text" : "trace-console";
    const artifact = await consoleArtifact(format, [secret.slice(0, cut), secret.slice(cut)]);
    let expected: unknown;
    if (format === "json-text") {
      const report = JSON.parse(artifact.bytes.toString()), test = report.suites[0].specs[0].tests[0], result = test.results[0];
      const second = result.stdout.pop();
      if (scope === "json-channel") result.stderr.push(second);
      else test.results.push({ ...result, stdout: [second], retry: 1 });
      expected = report;
      artifact.bytes = Buffer.from(JSON.stringify(report));
    } else {
      const bytes = format === "blob-text" ? (await unzip(artifact.bytes)).get("report.jsonl")! : artifact.bytes;
      const events = bytes.toString().split("\n").map(line => JSON.parse(line));
      if (scope === "blob-channel") events[2].params.type = "stderr";
      if (scope === "blob-test") events[2].params.testId = "test-2";
      if (scope === "blob-result") events[2].params.resultId = "result-2";
      if (scope === "trace-channel") events[2].type = "stderr";
      if (scope === "trace-page") events[2].pageId = "page-2";
      if (scope === "trace-type") events[2].messageType = "warn";
      expected = events;
      const changed = Buffer.from(events.map(event => JSON.stringify(event)).join("\n"));
      artifact.bytes = format === "blob-text" ? await zip({ "report.jsonl": changed }) : changed;
    }
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await sanitizeRun({ root });
    const output = await readFile(join(root, "publish", artifact.name));
    const actual = format === "json-text" ? JSON.parse(output.toString()) :
      (format === "blob-text" ? (await unzip(output)).get("report.jsonl")! : output).toString().split("\n").filter(Boolean).map(line => JSON.parse(line));
    expect(JSON.stringify(actual) === JSON.stringify(expected)).toBe(true);
  });

  it("fragmentos: conserva orden del resultado entre eventos blob intercalados", async () => {
    const secret = `INTERLEAVED_${randomUUID()}`, cut = Math.floor(secret.length / 2);
    await writeFile(join(root, "raw", "session.json"), JSON.stringify({ access_token: secret }));
    const artifact = await consoleArtifact("blob-text", [secret.slice(0, cut), secret.slice(cut)]);
    const events = (await unzip(artifact.bytes)).get("report.jsonl")!.toString().split("\n").map(line => JSON.parse(line));
    events.splice(2, 0, { method: "onStdIO", params: { type: "stdout", testId: "test-2", resultId: "result-2", data: "otro resultado", isBase64: false } });
    await writeFile(join(root, "raw", artifact.name), await zip({ "report.jsonl": Buffer.from(events.map(event => JSON.stringify(event)).join("\n")) }));
    await expect(sanitizeRun({ root })).rejects.toThrow("verification");
    expect(await readdir(root)).not.toContain("publish");
  });

  it("fragmentos: rechaza múltiples eventos blob sin identidad atribuible", async () => {
    const artifact = await consoleArtifact("blob-text", ["salida uno", "salida dos"]);
    const events = (await unzip(artifact.bytes)).get("report.jsonl")!.toString().split("\n").map(line => JSON.parse(line));
    for (const event of events.filter(event => event.method === "onStdIO")) {
      delete event.params.testId;
      delete event.params.resultId;
    }
    await writeFile(join(root, "raw", artifact.name), await zip({ "report.jsonl": Buffer.from(events.map(event => JSON.stringify(event)).join("\n")) }));
    await expect(sanitizeRun({ root })).rejects.toThrow("(console-scope)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each(["blob-text", "trace-text"])("fragmentos: rechaza cabeceras de contexto repetidas en %s", async (format) => {
    const artifact = await consoleArtifact(format, ["salida uno", "salida dos"]);
    const bytes = format === "blob-text" ? (await unzip(artifact.bytes)).get("report.jsonl")! : artifact.bytes;
    const events = bytes.toString().split("\n").map(line => JSON.parse(line));
    events.splice(2, 0, events[0]);
    const changed = Buffer.from(events.map(event => JSON.stringify(event)).join("\n"));
    await writeFile(join(root, "raw", artifact.name), format === "blob-text" ? await zip({ "report.jsonl": changed }) : changed);
    await expect(sanitizeRun({ root })).rejects.toThrow("version");
    expect(await readdir(root)).not.toContain("publish");
  });

  it("fragmentos: limita la cantidad de nodos antes de agregar", async () => {
    const artifact = await consoleArtifact("json-text", Array.from({ length: 20_001 }, () => "!"));
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow("(limits)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it("fragmentos: rechaza UTF-8 cortado entre buffers canónicos", async () => {
    const artifact = await consoleArtifact("json-buffer", ["", ""]);
    const report = JSON.parse(artifact.bytes.toString());
    report.suites[0].specs[0].tests[0].results[0].stdout = [{ buffer: "ww==" }, { buffer: "qQ==" }];
    await writeFile(join(root, "raw", artifact.name), JSON.stringify(report));
    await expect(sanitizeRun({ root })).rejects.toThrow("(console-encoding)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each([false, true])("fragmentos: rechaza sustitución silenciosa de surrogates, envoltura JSON: %s", async (quoted) => {
    const parts = ["\ud83d", "\ude00"].map(text => quoted ? JSON.stringify(text) : text);
    const artifact = await consoleArtifact("json-text", parts);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow("(console-encoding)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each(["text", "buffer"].flatMap(transport => ["known-stdout", "known-stderr", "basic"].map(mode => ({ transport, mode }))))("fragmentos reales Playwright: $transport/$mode", async ({ transport, mode }) => {
    const secret = `KNOWN_${randomUUID()}`, password = `BASIC_${randomUUID()}`;
    const credentials = Buffer.from(`user:${password}`).toString("base64");
    const cut = Math.floor(secret.length / 2);
    const streams = {
      stdout: mode === "known-stdout" ? [secret.slice(0, cut), secret.slice(cut)] : ["Authorization: Basic ", credentials],
      stderr: mode === "known-stderr" ? [secret.slice(0, cut), secret.slice(cut)] : ["Authorization: Basic ", credentials],
    };
    const capture = join(folder, "capture");
    await mkdir(capture);
    await writeFile(join(folder, "fragments.config.cjs"), `module.exports = ${JSON.stringify({
      testDir: folder, testMatch: "fragments.spec.cjs", workers: 1, retries: 0,
      outputDir: join(capture, "results"),
      reporter: [["blob", { outputDir: join(capture, "blob") }], ["json", { outputFile: join(capture, "report.json") }]],
    })};`);
    await writeFile(join(folder, "fragments.spec.cjs"), `
const { test } = require(${JSON.stringify(require.resolve("@playwright/test"))});
test("fragmentos", async () => {
  const streams = ${JSON.stringify(streams)};
  for (const channel of ["stdout", "stderr"]) for (const value of streams[channel]) {
    process[channel].write(${transport === "buffer" ? "Buffer.from(value)" : "value"});
    await new Promise(resolve => setTimeout(resolve, 5));
  }
});`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PLAYWRIGHT_|PW_)/.test(key) && key !== "PWDEBUG"));
    const run = await command(process.execPath, [require.resolve("@playwright/test/cli"), "test", "-c", join(folder, "fragments.config.cjs")], folder, env);
    expect(run.code).toBe(0);
    const nativeBytes = await readFile(join(capture, "report.json"));
    const native = JSON.parse(nativeBytes.toString());
    const result = native.suites[0].specs[0].tests[0].results[0];
    for (const channel of ["stdout", "stderr"]) {
      expect(result[channel].length).toBe(2);
      expect(result[channel].map((chunk: { text?: string; buffer?: string }) => chunk.text ?? Buffer.from(chunk.buffer!, "base64").toString()).join("") === streams[channel as keyof typeof streams].join("")).toBe(true);
    }
    const blobs = await readdir(join(capture, "blob"));
    const blobBytes = await readFile(join(capture, "blob", blobs.find(name => name.endsWith(".zip"))!));
    const originalEvents = (await unzip(blobBytes)).get("report.jsonl")!.toString().split("\n").filter(Boolean).map(line => JSON.parse(line));
    expect(originalEvents.filter(event => event.method === "onStdIO").length).toBe(4);
    const checks: boolean[] = [];
    for (const format of ["json", "blob"]) for (const stage of ["clean", "publish", "render"] as const) {
      const owned = join(folder, `case-${format}-${stage}`);
      await initializeRun(owned);
      await writeFile(join(owned, "raw", "session.json"), JSON.stringify(mode === "basic" ? { status: "passed" } : { access_token: secret }));
      if (stage === "render") await sanitizeRun({ root: owned, output: "clean" });
      const name = format === "json" ? "runner.json" : "report.zip";
      await writeFile(join(owned, stage === "render" ? "render" : "raw", name), format === "json" ? nativeBytes : blobBytes);
      let rejected = false;
      try { await sanitizeRun({ root: owned, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish" }); } catch { rejected = true; }
      if (mode !== "basic") {
        checks.push(rejected && !(await readdir(owned)).includes(stage === "clean" ? "clean" : "publish"));
        continue;
      }
      if (rejected) { checks.push(false); continue; }
      const safe = await readFile(join(owned, stage === "clean" ? "clean" : "publish", name));
      const channels: Record<string, string[]> = { stdout: [], stderr: [] };
      if (format === "json") {
        const report = JSON.parse(safe.toString());
        const after = report.suites[0].specs[0].tests[0].results[0];
        expect(report.stats).toEqual(native.stats);
        expect([after.status, after.duration, after.retry]).toEqual([result.status, result.duration, result.retry]);
        for (const channel of ["stdout", "stderr"]) channels[channel] = after[channel].map((chunk: { text?: string; buffer?: string }) => chunk.text ?? Buffer.from(chunk.buffer!, "base64").toString());
      } else {
        const events = (await unzip(safe)).get("report.jsonl")!.toString().split("\n").filter(Boolean).map(line => JSON.parse(line));
        expect(events.filter(event => event.method === "onTestEnd")).toEqual(originalEvents.filter(event => event.method === "onTestEnd"));
        for (const event of events.filter(event => event.method === "onStdIO")) channels[event.params.type]!.push(event.params.isBase64 ? Buffer.from(event.params.data, "base64").toString() : event.params.data);
      }
      for (const channel of ["stdout", "stderr"]) {
        expect(channels[channel]!.length).toBe(2);
        const joined = channels[channel]!.join("");
        checks.push(!joined.includes(credentials) && !joined.includes(password));
      }
    }
    expect(checks.every(Boolean), "la consola fragmentada debe sanearse o bloquearse en cada fase y formato").toBe(true);
  }, 60_000);

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer", "trace-text", "trace-buffer"].flatMap(format =>
    (["clean", "publish", "render"] as const).map(stage => ({ format, stage })),
  ))("consola: rechaza mezcla en stderr $format/$stage", async ({ format, stage }) => {
    await writeFile(join(root, "raw", "session.json"), '{"status":"failed"}');
    if (stage === "render") await sanitizeRun({ root, output: "clean" });
    const text = `Worker: ${JSON.stringify({ password: `CONSOLE_${randomUUID()}` }, null, 2)}\n[WebServer] listo`;
    const artifact = await consoleArtifact(format, text, undefined, "stderr");
    await writeFile(join(root, stage === "render" ? "render" : "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish" })).rejects.toThrow("(json)");
    expect(await readdir(root)).not.toContain("publish");
    if (stage === "clean") expect(await readdir(root)).not.toContain("clean");
  });

  it.each(["json-buffer", "blob-buffer", "trace-buffer"].flatMap(format =>
    ["YQ", "c2VjcmV0\n", "/w=="].map(buffer => ({ format, buffer })),
  ))("consola: rechaza buffer no canónico o no UTF-8 en $format/$buffer", async ({ format, buffer }) => {
    const artifact = await consoleArtifact(format, "", buffer);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow("(console-encoding)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer"].flatMap(format =>
    (["clean", "render"] as const).flatMap(stage => [1, 2, 10].map(layers => ({ format, stage, layers }))),
  ))("consola: valida envolturas $format/$stage/$layers", async ({ format, stage, layers }) => {
    const secret = `CONSOLE_${randomUUID()}`;
    await writeFile(join(root, "raw", "session.json"), '{"status":"failed"}');
    if (stage === "render") await sanitizeRun({ root, output: "clean" });
    let text = `Worker: ${JSON.stringify({ password: secret })}\n[WebServer] listo`;
    for (let i = 0; i < layers; i++) text = Buffer.from(text).toString("base64");
    const artifact = await consoleArtifact(format, text);
    await writeFile(join(root, stage === "render" ? "render" : "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root, input: stage === "render" ? "render" : "raw", output: stage === "clean" ? "clean" : "publish" }))
      .rejects.toThrow(layers === 10 ? "(limits)" : "(json)");
    expect(await readdir(root)).not.toContain("publish");
    if (stage === "clean") expect(await readdir(root)).not.toContain("clean");
  });

  it("consola: no interpreta campos homónimos fuera de los formatos reconocidos", async () => {
    const value = { error: { message: '{"example": true}\ncode frame', snippet: "fn({ example: true })", stack: "at fn ({file}:1)" }, stdout: [{ text: "const value = { example: true };" }], params: { data: "const value = { example: true };" } };
    await writeFile(join(root, "raw", "diagnostic.json"), JSON.stringify(value));
    await sanitizeRun({ root });
    expect(JSON.parse(await readFile(join(root, "publish", "diagnostic.json"), "utf8"))).toEqual(value);
  });

  it.each(["json-text", "json-buffer", "blob-text", "blob-buffer"].flatMap(format => [false, true].map(mixed => ({ format, mixed }))))("consola: valida strings JSON envolventes $format/mixto:$mixed", async ({ format, mixed }) => {
    const secret = `CONSOLE_${randomUUID()}`;
    const wrap = (s: string) => Buffer.from(s).toString("base64");
    const payload = JSON.stringify({ password: secret });
    const text = JSON.stringify(mixed ? `Worker: ${payload}\n[WebServer] listo` : wrap(wrap(payload)));
    const artifact = await consoleArtifact(format, text);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    if (mixed) {
      await expect(sanitizeRun({ root })).rejects.toThrow("(json)");
      expect(await readdir(root)).not.toContain("publish");
    } else {
      await sanitizeRun({ root });
      for (const content of await consoleContents(format, await readFile(join(root, "publish", artifact.name)))) {
        const value = JSON.parse(Buffer.from(Buffer.from(JSON.parse(content), "base64").toString(), "base64").toString());
        expect(value.password === "[REDACTED]").toBe(true);
      }
    }
  });

  it.each(["json-text", "blob-buffer"])("consola: limita strings JSON anidados en %s", async (format) => {
    let text = JSON.stringify({ password: `CONSOLE_${randomUUID()}` });
    for (let i = 0; i < 10; i++) text = JSON.stringify(text);
    const artifact = await consoleArtifact(format, text);
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow("(limits)");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each(["json-text", "blob-text", "trace-text"].flatMap(format => [false, true].map(missing => ({ format, missing }))))("consola: exige versión reconocida $format/ausente:$missing", async ({ format, missing }) => {
    const artifact = await consoleArtifact(format, "[WebServer] listo");
    if (format === "json-text") {
      const report = JSON.parse(artifact.bytes.toString());
      if (missing) delete report.config;
      else report.config.version = "0.0.0";
      artifact.bytes = Buffer.from(JSON.stringify(report));
    } else {
      const bytes = format === "blob-text" ? (await unzip(artifact.bytes)).get("report.jsonl")! : artifact.bytes;
      const events = bytes.toString().split("\n").map(line => JSON.parse(line));
      if (missing) events.shift();
      else if (format === "blob-text") events[0].params.version = 99;
      else events[0].version = 99;
      const changed = Buffer.from(events.map(event => JSON.stringify(event)).join("\n"));
      artifact.bytes = format === "blob-text" ? await zip({ "report.jsonl": changed }) : changed;
    }
    await writeFile(join(root, "raw", artifact.name), artifact.bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow("version");
    expect(await readdir(root)).not.toContain("publish");
  });

  it("logs: un prefijo textual no habilita formatos desconocidos", async () => {
    await writeFile(join(root, "raw", "unsupported.bin"), "[WebServer] listo");
    await expect(sanitizeRun({ root })).rejects.toThrow();
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each(["broken.zip", "broken.json", "broken.network", "unsupported.bin"])("no publica ante formato inválido: %s", async (name) => {
    await writeFile(join(root, "raw", name), Buffer.from([0, 255, 42]));
    const result = await command(process.execPath, [script, "sanitize", "--root", root]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("No se publicaron artefactos");
    expect(await readdir(root)).not.toContain("publish");
    expect((await readdir(root)).some((name) => name.startsWith(".stage-"))).toBe(false);
  });

  it("rechaza CRC incorrecto sin inventar un lector ZIP", async () => {
    const bytes = await zip({ "entry.txt": Buffer.from("UNIQUE_STORED_PAYLOAD") }, false);
    bytes[bytes.indexOf("UNIQUE_STORED_PAYLOAD")] = 65;
    await writeFile(join(root, "raw", "bad.zip"), bytes);
    await expect(sanitizeRun({ root })).rejects.toThrow();
    expect(await readdir(root)).not.toContain("publish");
  });

  it("rechaza descompresión anómala, versiones de traza no soportadas y enlaces", async () => {
    const bomb = await zip({ "large.txt": Buffer.alloc(2 * 1024 * 1024, 65) });
    await writeFile(join(root, "raw", "bomb.zip"), bomb);
    await expect(sanitizeRun({ root })).rejects.toThrow();
    await rm(join(root, "raw", "bomb.zip"));
    await writeFile(join(root, "raw", "future.trace"), '{"type":"context-options","version":999,"options":{}}\n');
    await expect(sanitizeRun({ root })).rejects.toThrow();
    await rm(join(root, "raw", "future.trace"));
    await writeFile(join(folder, "external.json"), "{}");
    await symlink(join(folder, "external.json"), join(root, "raw", "external.json"));
    await expect(sanitizeRun({ root })).rejects.toThrow();
    expect(await readdir(root)).not.toContain("publish");
  });

  it("no sobrescribe salidas ni permite solapar entrada y salida", async () => {
    await writeFile(join(root, "raw", "report.json"), "{}");
    await mkdir(join(root, "publish"));
    await writeFile(join(root, "publish", "kept.txt"), "conservar");
    await expect(sanitizeRun({ root })).rejects.toThrow();
    expect(await readFile(join(root, "publish", "kept.txt"), "utf8")).toBe("conservar");
    const result = await command(process.execPath, [script, "sanitize", "--root", root, "--input", "raw", "--output", "raw"]);
    expect(result.code).not.toBe(0);
  });

  it("la última pasada reaplica los secretos de raw a informes regenerados, sin publicarlos por separado", async () => {
    const secret = `CANARY_${randomUUID()}`;
    await writeFile(join(root, "raw", "session.json"), JSON.stringify({ access_token: secret }));
    await sanitizeRun({ root, output: "clean" });
    expect(await readdir(root)).not.toContain("publish");
    await writeFile(join(root, "render", "e2e-normalized.json"), JSON.stringify({ status: "failed", duration: 32, error: `Fragmento releído: ${secret}` }));
    await sanitizeRun({ root, input: "render" });
    await inspectDirectory(join(root, "publish"), [secret]);
  });

  it("sanea parámetros form y sus copias sin requerir un JSON de sesión", async () => {
    const first = `FORM_${randomUUID()}`;
    const second = `PARAM_${randomUUID()}`;
    await writeFile(join(root, "raw", "network.json"), JSON.stringify({
      postData: { text: `refresh_token=${encodeURIComponent(first)}`, params: [{ name: "access_token", value: second }] },
      errors: [`No se pudo enviar ${first}`, `No se pudo enviar ${second}`],
    }));
    await sanitizeRun({ root });
    await inspectDirectory(join(root, "publish"), [first, second]);
  });

  it("no expone valores en los errores de CLI ni publica un conjunto incompleto", async () => {
    const canary = `PRIVATE_${randomUUID()}`;
    await writeFile(join(root, "raw", "a-good.json"), JSON.stringify({ status: "failed", access_token: canary }));
    await writeFile(join(root, "raw", "z-bad.json"), `{${canary}`);
    const result = await command(process.execPath, [script, "sanitize", "--root", root]);
    expect(result.code).toBe(1);
    expect(result.stderr.includes(canary)).toBe(false);
    expect(result.stdout.includes(canary)).toBe(false);
    expect(await readdir(root)).not.toContain("publish");
  });

  it("rechaza nombres repetidos en ZIP y un HTML con un ZIP base64 dañado", async () => {
    const archive = new yazl.ZipFile();
    const chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((done) => {
      archive.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.outputStream.on("end", () => done(Buffer.concat(chunks)));
    });
    const privateName = `PRIVATE_${randomUUID()}.json`;
    archive.addBuffer(Buffer.from("{}"), privateName);
    archive.addBuffer(Buffer.from("{}"), privateName);
    archive.end();
    await writeFile(join(root, "raw", "duplicate.zip"), await finished);
    await expect(sanitizeRun({ root })).rejects.toMatchObject({ code: "zip-duplicate" });
    const result = await command(process.execPath, [script, "sanitize", "--root", root]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("zip-duplicate");
    expect(result.stdout + result.stderr).not.toContain(privateName);
    await rm(join(root, "raw", "duplicate.zip"));
    await writeFile(join(root, "raw", "bad.html"), '<template id="playwrightReportBase64">data:application/zip;base64,@@@</template>');
    await expect(sanitizeRun({ root })).rejects.toThrow();
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each([
    { offset: 8, value: 1, width: 2, code: "zip-encrypted" },
    { offset: 10, value: 99, width: 2, code: "zip-compression" },
    { offset: 38, value: 0xa0000000, width: 4, code: "zip-type" },
  ])("distingue $code sin publicar el ZIP ni revelar su nombre privado", async ({ offset, value, width, code }) => {
    const privateName = `PRIVATE_${randomUUID()}.txt`;
    const bytes = await zip({ [privateName]: Buffer.from("contenido privado") }, code === "zip-encrypted");
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThanOrEqual(0);
    if (width === 2) bytes.writeUInt16LE(value, central + offset);
    else bytes.writeUInt32LE(value, central + offset);
    await writeFile(join(root, "raw", "unsupported.zip"), bytes);
    const result = await command(process.execPath, [script, "sanitize", "--root", root]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(code);
    expect(result.stdout + result.stderr).not.toContain(privateName);
    expect(await readdir(root)).not.toContain("publish");
  });

  it("no publica capturas cuando un secreto conocido aparece en el DOM", async () => {
    const secret = `VISIBLE_${randomUUID()}`;
    await writeFile(join(root, "raw", "0.trace"), [
      { type: "context-options", version: 10, options: { storageState: { access_token: secret } } },
      { type: "frame-snapshot", snapshot: { html: ["HTML", {}, ["BODY", {}, secret]] } },
    ].map(value => JSON.stringify(value)).join("\n"));
    await expect(sanitizeRun({ root })).rejects.toThrow("visual-credential");
    expect(await readdir(root)).not.toContain("publish");
  });

  it.each([false, true])("canarios en Chromium: traza real, red, blob y HTML sin DB ni solicitudes externas, consola mixta: %s", async (mixed) => {
    const canaries = Array.from({ length: 9 }, () => `CANARY_${randomUUID()}`);
    const canaryEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PLAYWRIGHT_|PW_)/.test(key) && key !== "PWDEBUG"));
    let requests = 0;
    const server = createServer((request, response) => {
      requests++;
      if (request.url?.startsWith("/auth/v1/")) {
        response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": `auth=${canaries[6]}; HttpOnly; Path=/` });
        response.end(JSON.stringify({ access_token: canaries[4], refresh_token: canaries[5], token_type: "bearer" }));
      } else if (request.url === "/pixel.png") {
        response.writeHead(200, { "Content-Type": "image/png" }).end(png);
      } else {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end('<h1>Diagnóstico sintético</h1><img src="/pixel.png">');
      }
    });
    const origin = await listen(server);
    const executablePath = process.env.CHROMIUM_PATH ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
    const config = {
      testDir: root, testMatch: "fixture.spec.cjs", workers: 1, retries: 0, timeout: 20_000,
      outputDir: join(root, "raw", "results"),
      reporter: [["blob", { outputDir: join(root, "raw", "blob") }], ["json", { outputFile: join(root, "raw", "e2e.json") }], ["html", { outputFolder: join(root, "raw", "html"), open: "never" }]],
      use: { trace: "retain-on-failure", launchOptions: { executablePath }, storageState: { cookies: [{ name: "session", value: canaries[3], domain: "127.0.0.1", path: "/" }], origins: [{ origin, localStorage: [{ name: "3bstays-auth", value: JSON.stringify({ access_token: canaries[0], refresh_token: canaries[1] }) }] }] } },
    };
    await writeFile(join(root, "fixture.config.cjs"), `module.exports = ${JSON.stringify(config)};`);
    await writeFile(join(root, "fixture.spec.cjs"), `
const { test, expect } = require(${JSON.stringify(require.resolve("@playwright/test"))});
test("caso diagnóstico", async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).origin === ${JSON.stringify(origin)} ? route.continue() : route.abort());
  await page.goto(${JSON.stringify(origin)});
  await page.evaluate(async data => {
    await fetch("/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { authorization: "Bearer " + data[0], apikey: data[2], "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: data[1] }) }).then(r => r.json());
  }, ${JSON.stringify(canaries)});
  await expect(page.getByRole("heading")).toHaveText("Diagnóstico sintético");
  const consoleData = ${JSON.stringify([canaries[8], canaries[0]])};
  const wrap = value => Buffer.from(value).toString("base64");
  const consoleText = ${JSON.stringify(mixed ? "Worker: " : "")} + JSON.stringify({ password: consoleData[0], error: wrap(wrap(JSON.stringify({ access_token: consoleData[1] }))) }) + ${JSON.stringify(mixed ? "\n[WebServer] listo" : "")};
  process.stdout.write(consoleText);
  process.stderr.write(Buffer.from(consoleText));
  await page.evaluate(value => console.log(JSON.stringify({ password: value })), consoleData[0]);
  throw new Error("Error sintético " + ${JSON.stringify(canaries[7])});
});`);
    await writeFile(join(root, "raw", "e2e-normalized.json"), JSON.stringify({ status: "failed", duration: 77, access_token: canaries[7], errors: [`Error sintético ${canaries[7]}`] }));
    try {
      const ran = await command(process.execPath, [require.resolve("@playwright/test/cli"), "test", "-c", join(root, "fixture.config.cjs")], folder, canaryEnv);
      expect(ran.code, "el caso sintético debe fallar una vez").toBe(1);
      const rawReport = JSON.parse(await readFile(join(root, "raw", "e2e.json"), "utf8"));
      expect(rawReport.stats.unexpected).toBe(1);
      expect(rawReport.stats.flaky).toBe(0);
      expect(requests).toBeGreaterThanOrEqual(3);
      const result = rawReport.suites[0].specs[0].tests[0].results[0];
      expect(result.stdout.some((chunk: { text?: string }) => chunk.text?.includes(canaries[8]!))).toBe(true);
      expect(result.stderr.some((chunk: { buffer?: string }) => chunk.buffer && Buffer.from(chunk.buffer, "base64").toString().includes(canaries[8]!))).toBe(true);
      expect(result.retry).toBe(0);
      expect(result.error.message.includes("Error sintético")).toBe(true);
      const tracePath = result.attachments.find((a: { name: string }) => a.name === "trace").path;
      const rawEntries = await unzip(await readFile(tracePath));
      const traceEvents = [...rawEntries].filter(([name]) => name.endsWith(".trace")).flatMap(([, bytes]) => bytes.toString().split("\n").filter(Boolean).map(line => JSON.parse(line)));
      expect(traceEvents.some(event => event.type === "stdout" && typeof event.text === "string")).toBe(true);
      expect(traceEvents.some(event => event.type === "stderr" && typeof event.base64 === "string")).toBe(true);
      expect(traceEvents.some(event => event.type === "console" && event.text.includes(canaries[8]!))).toBe(true);
      const blobNames = await readdir(join(root, "raw", "blob"));
      const blobEntries = await unzip(await readFile(join(root, "raw", "blob", blobNames.find(name => name.endsWith(".zip"))!)));
      const blobEvents = blobEntries.get("report.jsonl")!.toString().split("\n").filter(Boolean).map(line => JSON.parse(line));
      expect(blobEvents.some(event => event.method === "onBlobReportMetadata" && event.params.version === 2)).toBe(true);
      expect(blobEvents.some(event => event.method === "onStdIO" && event.params.isBase64 === false)).toBe(true);
      expect(blobEvents.some(event => event.method === "onStdIO" && event.params.isBase64 === true)).toBe(true);
      const network = [...rawEntries].filter(([name]) => name.endsWith(".network")).flatMap(([, bytes]) => bytes.toString().split("\n").filter(Boolean).map(line => JSON.parse(line)));
      const auth = network.map(event => event.snapshot).find(snapshot => snapshot?.request?.url.includes("/auth/v1/token"));
      expect(auth.request.method).toBe("POST");
      expect(auth.response.status).toBe(200);
      expect(auth.request.headers.some((h: { name: string; value: string }) => h.name.toLowerCase() === "authorization" && h.value.includes(canaries[0]!))).toBe(true);
      expect(auth.request.headers.some((h: { name: string; value: string }) => h.name.toLowerCase() === "apikey" && h.value === canaries[2])).toBe(true);
      expect(auth.request.headers.some((h: { name: string; value: string }) => h.name.toLowerCase() === "cookie" && h.value.includes(canaries[3]!))).toBe(true);
      expect(auth.response.headers.some((h: { name: string; value: string }) => h.name.toLowerCase() === "set-cookie" && h.value.includes(canaries[6]!))).toBe(true);
      const requestRef = auth.request.postData._file ?? auth.request.postData._sha1;
      const responseRef = auth.response.content._file ?? auth.response.content._sha1;
      const requestBody = rawEntries.get(requestRef) ?? rawEntries.get(`resources/${requestRef}`)!;
      const responseBody = rawEntries.get(responseRef) ?? rawEntries.get(`resources/${responseRef}`)!;
      expect(requestBody.includes(Buffer.from(canaries[1]!))).toBe(true);
      expect(responseBody.includes(Buffer.from(canaries[4]!)) && responseBody.includes(Buffer.from(canaries[5]!))).toBe(true);
      if (mixed) {
        await expect(sanitizeRun({ root, output: "clean" })).rejects.toThrow("(json)");
        expect(await readdir(root)).not.toContain("clean");
        expect(await readdir(root)).not.toContain("publish");
        return;
      }
      await sanitizeRun({ root, output: "clean" });
      await inspectDirectory(join(root, "clean"), canaries);
      expect(JSON.parse(await readFile(join(root, "clean", "e2e.json"), "utf8")).stats).toEqual(rawReport.stats);
      const rendered = await command(process.execPath, [require.resolve("@playwright/test/cli"), "merge-reports", "--reporter=html,json", join(root, "clean", "blob")], folder, {
        ...canaryEnv, PLAYWRIGHT_HTML_OPEN: "never", PLAYWRIGHT_HTML_OUTPUT_DIR: join(root, "render", "html"), PLAYWRIGHT_JSON_OUTPUT_FILE: join(root, "render", "e2e.json"),
      });
      expect(rendered.code).toBe(0);
      const renderedReport = JSON.parse(await readFile(join(root, "render", "e2e.json"), "utf8"));
      await writeFile(join(root, "render", "e2e-normalized.json"), await readFile(join(root, "raw", "e2e-normalized.json")));
      await sanitizeRun({ root, input: "render" });
      await inspectDirectory(join(root, "publish"), canaries);
      const safeReport = JSON.parse(await readFile(join(root, "publish", "e2e.json"), "utf8"));
      for (const report of [JSON.parse(await readFile(join(root, "clean", "e2e.json"), "utf8")), safeReport]) {
        const safeResult = report.suites[0].specs[0].tests[0].results[0];
        expect(safeResult.stdout.length).toBe(result.stdout.length);
        expect(safeResult.stderr.length).toBe(result.stderr.length);
        for (const chunk of [...safeResult.stdout, ...safeResult.stderr]) {
          const value = JSON.parse(chunk.text ?? Buffer.from(chunk.buffer, "base64").toString());
          expect(value.password === "[REDACTED]").toBe(true);
          const nested = JSON.parse(Buffer.from(Buffer.from(value.error, "base64").toString(), "base64").toString());
          expect(nested.access_token === "[REDACTED]").toBe(true);
        }
      }
      expect(safeReport.stats).toEqual(renderedReport.stats);
      expect(safeReport.stats.duration).toBeCloseTo(rawReport.stats.duration, 2);
      const normalized = JSON.parse(await readFile(join(root, "publish", "e2e-normalized.json"), "utf8"));
      expect(normalized).toMatchObject({ status: "failed", duration: 77 });
      const htmlRoot = join(root, "publish", "html");
      const viewer = createServer(async (request, response) => {
        const pathname = new URL(request.url!, "http://local").pathname;
        const file = resolve(htmlRoot, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`);
        if (!file.startsWith(`${htmlRoot}/`)) { response.writeHead(403).end(); return; }
        try {
          const body = await readFile(file);
          const mime = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : "application/octet-stream";
          response.writeHead(200, { "Content-Type": mime }).end(body);
        } catch { response.writeHead(404).end(); }
      });
      const publicOrigin = await listen(viewer);
      const browser = await chromium.launch({ executablePath });
      try {
        const page = await browser.newPage();
        await page.route("**/*", route => new URL(route.request().url()).origin === publicOrigin ? route.continue() : route.abort());
        await page.goto(publicOrigin);
        await page.getByText("caso diagnóstico", { exact: true }).waitFor();
        await page.getByText("caso diagnóstico", { exact: true }).click();
        await page.getByText(/Error sintético/).first().waitFor();
        const data = await readdir(join(htmlRoot, "data"));
        const trace = data.find(name => name.endsWith(".zip"));
        expect(trace).toBeDefined();
        const safeEntries = await unzip(await readFile(join(htmlRoot, "data", trace!)));
        expect([...safeEntries.values()].some(bytes => bytes.equals(png))).toBe(true);
        expect((safeEntries.get(responseRef) ?? safeEntries.get(`resources/${responseRef}`))!.toString()).toContain("Auth payload omitted");
        await page.goto(`${publicOrigin}/trace/index.html?trace=${encodeURIComponent(`${publicOrigin}/data/${trace}`)}`);
        await page.getByText("Navigate", { exact: true }).first().waitFor();
        await page.getByText("Evaluate", { exact: true }).first().waitFor();
      } finally {
        await browser.close();
        await close(viewer);
      }
    } finally {
      await close(server);
    }
  }, 60_000);
});
