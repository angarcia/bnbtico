import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as zlib from "node:zlib";
import yauzl from "yauzl";
import yazl from "yazl";

const require = createRequire(import.meta.url);
const REDACTED = "[REDACTED]";
const OMITTED = '{"_sanitized":"Auth payload omitted"}';
const MARKER = ".local-playwright-artifacts.json";
const VERSION = "1.64.1";
const LIMITS = Object.freeze({ file: 32 * 1024 * 1024, total: 256 * 1024 * 1024, entries: 20_000, depth: 8, ratio: 200, secrets: 10_000 });
const SENSITIVE = new Set(["accesstoken", "refreshtoken", "idtoken", "token", "secret", "clientsecret", "password", "authorization", "proxyauthorization", "apikey", "xapikey", "servicerolekey", "supabaseservicerolekey", "codeverifier", "qrcode", "otpauthurl", "otpauthuri"]);
const HEADERS = new Set(["authorization", "proxyauthorization", "apikey", "xapikey", "cookie", "setcookie"]);
const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const fail = (code) => { throw new ArtifactError(code); };

class ArtifactError extends Error {
  constructor(code) {
    super(`No se publicaron artefactos (${code}).`);
    this.code = code;
  }
}

function runtime() {
  if (typeof zlib.crc32 !== "function") fail("runtime-crc");
  for (const [name, version] of [["@playwright/test", VERSION], ["yauzl", "3.4.0"], ["yazl", "3.3.1"]]) {
    if (require(`${name}/package.json`).version !== version) fail("version");
  }
}

function below(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function rootPath(root) {
  if (typeof root !== "string" || !path.isAbsolute(root) || root !== path.resolve(root)) fail("root");
  const parent = await fs.realpath(path.dirname(root));
  const allowed = await Promise.all([tmpdir(), ...(process.env.RUNNER_TEMP ? [process.env.RUNNER_TEMP] : [])].map(p => fs.realpath(p)));
  const resolved = path.join(parent, path.basename(root));
  if (!allowed.some(p => below(p, resolved))) fail("temporary-root");
  return resolved;
}

async function regular(file) {
  const info = await fs.lstat(file);
  if (!info.isFile() || info.nlink !== 1 || info.size > LIMITS.file) fail("file");
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.ino !== info.ino || opened.dev !== info.dev) fail("changed-input");
    const bytes = await handle.readFile();
    if (bytes.length !== info.size || (await handle.stat()).mtimeMs !== info.mtimeMs) fail("changed-input");
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function initializeRun(root) {
  try {
    runtime();
    root = await rootPath(root);
    await fs.mkdir(root, { mode: 0o700 });
    await fs.writeFile(path.join(root, MARKER), JSON.stringify({ kind: "local-disposable-playwright", schema: 1, playwright: VERSION }), { mode: 0o600, flag: "wx" });
    for (const dir of ["raw", "render"]) await fs.mkdir(path.join(root, dir), { mode: 0o700 });
  } catch (error) {
    throw error instanceof ArtifactError ? error : new ArtifactError("initialization");
  }
}

async function ownedRoot(root) {
  root = await rootPath(root);
  const info = await fs.lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) fail("private-root");
  const marker = JSON.parse((await regular(path.join(root, MARKER))).toString());
  if (marker.kind !== "local-disposable-playwright" || marker.schema !== 1 || marker.playwright !== VERSION) fail("marker");
  return root;
}

function safeName(name) {
  if (!name || /[\\:\x00-\x1f\x7f]/.test(name) || name.startsWith("/") || name.split("/").some(p => p === "." || p === ".." || p === "")) fail("entry-name");
}

function context() {
  return { nodes: [], entries: 0, bytes: 0, secrets: new Set(), strings: new Map(), consoleFields: new WeakMap(), authResources: new Set(), omitted: 0 };
}

function account(ctx, bytes, depth) {
  ctx.bytes += bytes;
  if (depth > LIMITS.depth || bytes > LIMITS.file || ctx.bytes > LIMITS.total || ctx.nodes.length >= LIMITS.entries) fail("limits");
}

function decode(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
}

function image(bytes) {
  return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    || /^GIF8[79]a/.test(bytes.subarray(0, 6).toString())
    || (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    || ["wOFF", "wOF2"].includes(bytes.subarray(0, 4).toString())
    || bytes.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]));
}

function json(text) {
  try { return JSON.parse(text); } catch { fail("json"); }
}

function structuredLog(text) {
  return /[{}\[]/.test(text.replace(/\x1b\[[0-9;]*m|\[WebServer\]|\[REDACTED\]/g, ""));
}

async function parse(name, bytes, ctx, depth = 0) {
  account(ctx, bytes.length, depth);
  const node = { name, bytes, depth, kind: "opaque" };
  ctx.nodes.push(node);
  if (bytes.subarray(0, 2).toString() === "PK" || name.endsWith(".zip")) {
    node.kind = "zip";
    node.entries = [];
    const archive = await yauzl.fromBufferPromise(bytes, { strictFileNames: true, validateEntrySizes: true });
    const names = new Set();
    try {
      for await (const entry of archive.eachEntry()) {
        if (++ctx.entries > LIMITS.entries) fail("entry-limits");
        const directory = entry.fileName.endsWith("/");
        const name = directory ? entry.fileName.slice(0, -1) : entry.fileName;
        safeName(name);
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (names.has(name)) fail("zip-duplicate");
        if (entry.isEncrypted()) fail("zip-encrypted");
        if (![0, 8].includes(entry.compressionMethod)) fail("zip-compression");
        if (![0, 0x8000, 0x4000].includes(mode)) fail("zip-type");
        if (entry.uncompressedSize > LIMITS.file || entry.uncompressedSize / Math.max(1, entry.compressedSize) > LIMITS.ratio) fail("zip-limits");
        names.add(name);
        const stream = await archive.openReadStreamPromise(entry);
        const chunks = [];
        let size = 0;
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > LIMITS.file || size > entry.uncompressedSize) { stream.destroy(); fail("zip-size"); }
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks);
        if (size !== entry.uncompressedSize || zlib.crc32(content) !== entry.crc32) fail("zip-integrity");
        if (directory) {
          if (size) fail("zip-directory");
          continue;
        }
        node.entries.push({ name, mtime: entry.getLastModDate(), node: await parse(name, content, ctx, depth + 1) });
      }
      for (const name of names) {
        const parts = name.split("/");
        for (let i = 1; i < parts.length; i++) {
          if (node.entries.some(e => e.name === parts.slice(0, i).join("/"))) fail("zip-path-conflict");
        }
      }
    } finally {
      archive.close();
    }
    return node;
  }
  if (image(bytes)) { node.kind = "image"; return node; }
  const text = decode(bytes);
  if (text === null) return node;
  if (/\.(trace|network|jsonl)$/.test(name)) {
    node.kind = "lines";
    node.value = text.split("\n").filter(l => l.trim()).map(json);
    for (const event of node.value) {
      if (event.type === "context-options" && event.version !== 10) fail("trace-version");
      if (event.method === "onBlobReportMetadata" && event.params?.version !== 2) fail("blob-version");
    }
  } else if (/\.(json|stacks|map)$/.test(name)
    || (!name.endsWith(".log") && /^[\s]*[\[{]/.test(text))
    || (name.endsWith(".log") && structuredLog(text))) {
    node.kind = "json";
    node.value = json(text);
  } else if (/\.(html|txt|md|log|csv|tsv|js|mjs|cjs|ts|tsx|css|svg|dat)$/.test(name) || name.includes("resources/") || /(?:^|\/)[a-f0-9]{40}(?:\.[\w-]+)?$/.test(name)) {
    node.kind = "text";
    node.text = text;
    node.embedded = [];
    for (const match of text.matchAll(/data:application\/zip;base64,([A-Za-z0-9+/]+={0,2})/g)) {
      const data = Buffer.from(match[1], "base64");
      if (data.toString("base64") !== match[1]) fail("html-base64");
      node.embedded.push({ text: match[0], node: await parse("embedded.zip", data, ctx, depth + 1) });
    }
    if (text.includes('<template id="playwrightReportBase64">') && node.embedded.length !== 1) fail("html-template");
  }
  return node;
}

async function tree(dir, ctx, prefix = "", depth = 0) {
  const info = await fs.lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink() || depth > LIMITS.depth) fail("directory");
  const files = [];
  for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (++ctx.entries > LIMITS.entries) fail("entry-limits");
    safeName(entry.name);
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await tree(path.join(dir, entry.name), ctx, `${name}/`, depth + 1));
    else files.push({ name, node: await parse(name, await regular(path.join(dir, entry.name)), ctx) });
  }
  return files;
}

function learn(ctx, value) {
  if (typeof value !== "string" || !value || value === REDACTED || value === OMITTED) return;
  if (value.length < 4 || value.length > LIMITS.file) fail("credential-shape");
  ctx.secrets.add(value);
  if (ctx.secrets.size > LIMITS.secrets) fail("secret-limits");
}

function header(ctx, name, value) {
  learn(ctx, value);
  if (typeof value !== "string") return;
  if (norm(name).includes("authorization")) learn(ctx, value.replace(/^(?:Bearer|Basic)\s+/i, ""));
  const basic = norm(name).includes("authorization") && /^Basic[ \t]+(.+)$/i.exec(value);
  if (basic) {
    const bytes = Buffer.from(basic[1], "base64");
    const credentials = decode(bytes);
    if (bytes.toString("base64") !== basic[1] || credentials === null || !credentials.includes(":")) fail("basic-encoding");
    learn(ctx, credentials);
    learn(ctx, credentials.slice(credentials.indexOf(":") + 1));
  }
  if (["cookie", "setcookie"].includes(norm(name))) {
    for (const part of value.split(";")) {
      const [key, ...parts] = part.trim().split("=");
      if (parts.length && !/^(path|domain|expires|max-age|samesite)$/i.test(key)) learn(ctx, parts.join("="));
    }
  }
}

function scan(ctx, text) {
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) learn(ctx, match[0]);
  for (const match of text.matchAll(/\bBearer\s+([A-Za-z0-9._~+/-]+=*)/gi)) learn(ctx, match[1]);
  for (const match of text.matchAll(/\b(?:Proxy-)?Authorization[ \t]*:[ \t]*(Basic[ \t]+[A-Za-z0-9+/]+={0,2})/gi)) header(ctx, "Authorization", match[1]);
  for (const match of text.matchAll(/["'](?:access_token|refresh_token|id_token|client_secret|apikey)["']\s*:\s*["']([^"'\r\n]+)["']/gi)) learn(ctx, match[1]);
  for (const match of text.matchAll(/(?:^|[?&])(access_token|refresh_token|apikey|token)=([^&#\s"']+)/gi)) {
    try { learn(ctx, decodeURIComponent(match[2].replaceAll("+", " "))); } catch { fail("query-encoding"); }
  }
}

async function encoded(value, ctx, depth) {
  const cached = ctx.strings.get(value);
  if (ctx.strings.has(value) && (!cached || cached.node.depth >= depth + 1)) return cached;
  ctx.strings.set(value, null);
  let bytes, encode;
  if (/^\s*[\[{]/.test(value)) {
    try { JSON.parse(value); bytes = Buffer.from(value); encode = b => b.toString(); } catch {}
  }
  if (!bytes && value.length >= 16 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.toString("base64") === value && (decode(decoded) !== null || image(decoded) || decoded.subarray(0, 2).toString() === "PK")) {
      bytes = decoded;
      encode = b => b.toString("base64");
    }
  }
  if (!bytes && value.length >= 16 && /^[A-Za-z0-9_-]+$/.test(value)) {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") === value && (decode(decoded) !== null || image(decoded) || decoded.subarray(0, 2).toString() === "PK")) {
      bytes = decoded;
      encode = b => b.toString("base64url");
    }
  }
  if (!bytes && /%[0-9a-f]{2}/i.test(value)) {
    try {
      const decoded = decodeURIComponent(value);
      if (encodeURIComponent(decoded).toLowerCase() === value.toLowerCase()) {
        bytes = Buffer.from(decoded);
        encode = b => encodeURIComponent(b.toString());
      }
    } catch {}
  }
  if (!bytes) return null;
  const node = await parse("encoded.txt", bytes, ctx, depth + 1);
  if (node.kind === "opaque") return null;
  const result = { node, encode, original: bytes };
  ctx.strings.set(value, result);
  return result;
}

function authSnapshot(value) {
  return value && typeof value === "object" && typeof value.request?.url === "string" && /\/auth\/v1(?:\/|[?#]|$)/.test(value.request.url);
}

function references(value, set) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["_sha1", "_file"].includes(key) && typeof child === "string") set.add(path.posix.basename(child));
    else references(child, set);
  }
}

async function consoleNode(bytes, ctx, depth) {
  const node = await parse("console.log", bytes, ctx, depth + 1);
  let current = node;
  while (current.kind === "text" || (current.kind === "json" && typeof current.value === "string")) {
    let quoted;
    if (current.kind === "json") quoted = current.value;
    else {
      if (structuredLog(current.text)) json(current.text);
      try { quoted = JSON.parse(current.text); } catch {}
    }
    if (typeof quoted === "string") {
      if (Buffer.from(quoted).toString() !== quoted) fail("console-encoding");
      current.quotedConsole = await parse("console.log", Buffer.from(quoted), ctx, current.depth + 1);
      current = current.quotedConsole;
      continue;
    }
    const wrapper = await encoded(current.text, ctx, current.depth);
    if (!wrapper) break;
    current = wrapper.node;
  }
  if (!["text", "json"].includes(current.kind)) fail("console-encoding");
  return node;
}

async function consoleField(object, key, base64, ctx, depth) {
  const value = object[key];
  if (typeof value !== "string") fail("console-shape");
  const bytes = Buffer.from(value, base64 ? "base64" : "utf8");
  if (bytes.toString(base64 ? "base64" : "utf8") !== value || decode(bytes) === null) fail("console-encoding");
  const node = await consoleNode(bytes, ctx, depth);
  let fields = ctx.consoleFields.get(object);
  if (!fields) ctx.consoleFields.set(object, fields = new Map());
  fields.set(key, { node, base64 });
  return node;
}

async function discoverConsole(node, ctx) {
  const groups = new Map();
  const add = (key, part, anonymous = false) => {
    let group = groups.get(key);
    if (!group) groups.set(key, group = { parts: [], bytes: 0 });
    if (anonymous && group.parts.length) fail("console-scope");
    group.bytes += part.bytes.length;
    if (group.bytes > LIMITS.file) fail("limits");
    group.parts.push(part.bytes);
  };
  const field = (object, key, base64 = false) => consoleField(object, key, base64, ctx, node.depth);
  const chunk = async (object, binaryKey) => {
    if (!object || typeof object !== "object" || Array.isArray(object)) fail("console-shape");
    const text = Object.hasOwn(object, "text"), binary = Object.hasOwn(object, binaryKey);
    if (text === binary) fail("console-shape");
    return field(object, text ? "text" : binaryKey, binary);
  };
  if (node.kind === "lines") {
    const blob = node.value.filter(e => e.method === "onBlobReportMetadata" && e.params?.version === 2).length;
    const trace = node.value.filter(e => e.type === "context-options" && e.version === 10).length;
    for (const event of node.value) {
      if (node.name.endsWith(".jsonl") && event.method === "onStdIO") {
        if (blob !== 1) fail("blob-version");
        if (!["stdout", "stderr"].includes(event.params?.type) || typeof event.params.isBase64 !== "boolean") fail("console-shape");
        const { testId, resultId, type } = event.params;
        const anonymous = testId === undefined && resultId === undefined;
        if (!anonymous && (typeof testId !== "string" || !testId || typeof resultId !== "string" || !resultId)) fail("console-scope");
        add(JSON.stringify(["blob", testId, resultId, type]), await field(event.params, "data", event.params.isBase64), anonymous);
      }
      if (node.name.endsWith(".trace") && ["stdout", "stderr", "console"].includes(event.type)) {
        if (trace !== 1) fail("trace-version");
        if (event.type !== "console") add(event.type, await chunk(event, "base64"));
        else {
          if (typeof event.pageId !== "string" || !event.pageId || typeof event.messageType !== "string" || !event.messageType) fail("console-scope");
          add(JSON.stringify(["console", event.pageId, event.messageType]), await field(event, "text"));
          if (!Array.isArray(event.args)) fail("console-shape");
          for (const arg of event.args) {
            await field(arg, "preview");
            if (typeof arg.value === "string") await field(arg, "value");
          }
        }
      }
    }
  }
  const report = node.value;
  if (node.kind === "json" && report && typeof report === "object" && Object.hasOwn(report, "suites")) {
    if (report.config?.version !== VERSION) fail("report-version");
    if (!Array.isArray(report.suites) || !Array.isArray(report.errors) || !report.stats || typeof report.stats !== "object") fail("report-shape");
    const suite = async (value, nesting = 0) => {
      if (nesting > 100) fail("json-depth");
      for (const spec of value.specs ?? []) for (const test of spec.tests) for (const result of test.results) {
        for (const name of ["stdout", "stderr"]) {
          if (!Array.isArray(result[name])) fail("console-shape");
          for (const entry of result[name]) add(result[name], await chunk(entry, "buffer"));
        }
      }
      for (const child of value.suites ?? []) await suite(child, nesting + 1);
    };
    await suite(report);
  }
  for (const group of groups.values()) {
    if (group.parts.length < 2) continue;
    if (ctx.bytes + group.bytes > LIMITS.total || node.depth + 1 > LIMITS.depth || ctx.nodes.length >= LIMITS.entries) fail("limits");
    await consoleNode(Buffer.concat(group.parts, group.bytes), ctx, node.depth);
  }
}

async function discoverValue(value, ctx, depth, key = "", nesting = 0) {
  if (nesting > 100) fail("json-depth");
  if (typeof value === "string") {
    scan(ctx, value);
    await encoded(value, ctx, depth);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (authSnapshot(value)) references(value, ctx.authResources);
  if (typeof value.name === "string") {
    if (HEADERS.has(norm(value.name))) header(ctx, value.name, value.value);
    else if (SENSITIVE.has(norm(value.name))) learn(ctx, value.value);
  }
  if (Array.isArray(value)) {
    if (norm(key) === "cookies") for (const cookie of value) learn(ctx, cookie?.value);
    for (const child of value) await discoverValue(child, ctx, depth, "", nesting + 1);
  } else {
    for (const [name, child] of Object.entries(value)) {
      if (ctx.consoleFields.get(value)?.has(name)) continue;
      if (HEADERS.has(norm(name)) && typeof child === "string") header(ctx, name, child);
      else if (SENSITIVE.has(norm(name))) learn(ctx, child);
      await discoverValue(child, ctx, depth, name, nesting + 1);
    }
  }
}

async function discover(ctx) {
  for (let i = 0; i < ctx.nodes.length; i++) {
    const node = ctx.nodes[i];
    await discoverConsole(node, ctx);
    if (["json", "lines"].includes(node.kind)) await discoverValue(node.value, ctx, node.depth);
    if (node.kind === "text") {
      scan(ctx, node.text);
      await encoded(node.text, ctx, node.depth);
    }
  }
  const variants = new Set();
  for (const secret of ctx.secrets) {
    for (const value of [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret), encodeURIComponent(secret).replace(/%[0-9A-F]{2}/g, v => v.toLowerCase()), encodeURIComponent(secret).replaceAll("%20", "+"), Buffer.from(secret).toString("base64"), Buffer.from(secret).toString("base64url"), secret.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;")]) {
      variants.add(value);
    }
  }
  ctx.variants = [...variants].sort((a, b) => b.length - a.length);
  const visual = value => {
    if (!value || typeof value !== "object") return;
    if (value.type === "frame-snapshot" && value.snapshot?.html) {
      const html = JSON.stringify(value.snapshot.html);
      if (scrub(html, ctx) !== html) fail("visual-credential");
    }
    for (const child of Object.values(value)) visual(child);
  };
  for (const node of ctx.nodes) if (["json", "lines"].includes(node.kind)) visual(node.value);
}

function scrub(text, ctx) {
  for (const value of ctx.variants) text = text.split(value).join(REDACTED);
  return text;
}

async function transform(value, ctx) {
  if (typeof value === "string") {
    const wrapper = ctx.strings.get(value);
    if (wrapper) {
      const safe = await render(wrapper.node, ctx);
      return safe.equals(wrapper.original) ? scrub(value, ctx) : wrapper.encode(safe);
    }
    return scrub(value, ctx);
  }
  if (Array.isArray(value)) return Promise.all(value.map(child => transform(child, ctx)));
  if (!value || typeof value !== "object") return value;
  const out = Object.create(null);
  const isHeader = typeof value.name === "string" && (HEADERS.has(norm(value.name)) || SENSITIVE.has(norm(value.name)));
  for (const [key, child] of Object.entries(value)) {
    const safeKey = scrub(key, ctx);
    if (Object.hasOwn(out, safeKey)) fail("key-collision");
    const consoleContent = ctx.consoleFields.get(value)?.get(key);
    if (consoleContent) {
      const bytes = ctx.secrets.has(consoleContent.node.bytes.toString()) ? Buffer.from(REDACTED) : await render(consoleContent.node, ctx);
      out[safeKey] = bytes.toString(consoleContent.base64 ? "base64" : "utf8");
    }
    else if (norm(key) === "storagestate") out[safeKey] = { cookies: [], origins: [], _sanitized: "Storage state omitted" };
    else if (norm(key) === "cookies") out[safeKey] = [];
    else if (SENSITIVE.has(norm(key)) || (isHeader && key === "value") || (HEADERS.has(norm(key)) && typeof child === "string")) out[safeKey] = REDACTED;
    else out[safeKey] = await transform(child, ctx);
  }
  if (authSnapshot(value)) {
    if (out.request.postData) out.request.postData = { ...out.request.postData, text: OMITTED, params: [], _sanitized: "Auth payload omitted" };
    if (out.response?.content) {
      out.response.content = { ...out.response.content, text: OMITTED, _sanitized: "Auth payload omitted" };
      delete out.response.content.encoding;
    }
  }
  return out;
}

async function makeZip(entries) {
  const archive = new yazl.ZipFile();
  const chunks = [];
  let size = 0;
  const done = new Promise((resolve, reject) => {
    archive.on("error", reject);
    archive.outputStream.on("error", reject);
    archive.outputStream.on("data", chunk => {
      size += chunk.length;
      if (size > LIMITS.file) archive.outputStream.destroy(new ArtifactError("output-size"));
      else chunks.push(chunk);
    });
    archive.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  for (const entry of entries) archive.addBuffer(entry.bytes, entry.name, { mtime: entry.mtime, mode: 0o100600 });
  archive.end();
  return done;
}

async function render(node, ctx) {
  if (ctx.authResources.has(path.posix.basename(node.name))) {
    ctx.omitted++;
    return Buffer.from(OMITTED);
  }
  if (node.quotedConsole) return Buffer.from(JSON.stringify((await render(node.quotedConsole, ctx)).toString()));
  if (node.kind === "zip") {
    const entries = [];
    for (const entry of node.entries) {
      if (scrub(entry.name, ctx) !== entry.name) fail("sensitive-filename");
      entries.push({ ...entry, bytes: await render(entry.node, ctx) });
    }
    return makeZip(entries);
  }
  if (node.kind === "opaque") fail("unsupported-binary");
  if (node.kind === "image") {
    if (ctx.variants.some(value => node.bytes.includes(Buffer.from(value)))) fail("sensitive-image");
    return node.bytes;
  }
  if (node.kind === "json") return Buffer.from(JSON.stringify(await transform(node.value, ctx)));
  if (node.kind === "lines") return Buffer.from((await Promise.all(node.value.map(async value => JSON.stringify(await transform(value, ctx))))).join("\n") + "\n");
  let text = node.text;
  for (const embedded of node.embedded) text = text.replace(embedded.text, `data:application/zip;base64,${(await render(embedded.node, ctx)).toString("base64")}`);
  return Buffer.from(await transform(text, ctx));
}

async function absent(file) {
  try { await fs.lstat(file); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  fail("existing-output");
}

export async function sanitizeRun({ root, input = "raw", output = "publish" }) {
  let lock, stage, owned;
  try {
    runtime();
    if (!["raw", "render"].includes(input) || !["clean", "publish"].includes(output) || (input === "render" && output !== "publish")) fail("arguments");
    owned = await ownedRoot(root);
    await absent(path.join(owned, output));
    lock = await fs.open(path.join(owned, ".sanitize.lock"), "wx", 0o600);
    const ctx = context();
    const raw = await tree(path.join(owned, "raw"), ctx);
    if (!raw.length) fail("empty-input");
    const files = input === "raw" ? raw : await tree(path.join(owned, input), ctx);
    if (!files.length) fail("empty-input");
    await discover(ctx);
    const safe = [];
    for (const file of files) {
      if (scrub(file.name, ctx) !== file.name) fail("sensitive-filename");
      safe.push({ name: file.name, bytes: await render(file.node, ctx) });
    }
    const checked = context();
    for (const file of safe) await parse(file.name, file.bytes, checked);
    await discover(checked);
    if (checked.secrets.size) fail("verification-sensitive-fields");
    for (const node of checked.nodes) {
      if (ctx.variants.some(value => node.bytes.includes(Buffer.from(value)))) fail("verification-copy");
    }
    stage = await fs.mkdtemp(path.join(owned, ".stage-"));
    for (const file of safe) {
      const destination = path.join(stage, file.name);
      await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await fs.writeFile(destination, file.bytes, { flag: "wx", mode: 0o600 });
      if (!(await regular(destination)).equals(file.bytes)) fail("verification-write");
    }
    const summary = { schema: 1, playwright: VERSION, files: safe.length, authPayloadsOmitted: ctx.omitted, verified: true };
    if (safe.some(file => file.name === "sanitization.json")) fail("reserved-filename");
    await fs.writeFile(path.join(stage, "sanitization.json"), JSON.stringify(summary), { flag: "wx", mode: 0o600 });
    await absent(path.join(owned, output));
    await fs.rename(stage, path.join(owned, output));
    stage = undefined;
    return summary;
  } catch (error) {
    throw error instanceof ArtifactError ? error : new ArtifactError("format-or-io");
  } finally {
    if (stage) await fs.rm(stage, { recursive: true, force: true });
    if (lock) {
      await lock.close();
      await fs.unlink(path.join(owned, ".sanitize.lock"));
    }
  }
}

async function cli(args) {
  const [action, ...flags] = args;
  const options = {};
  for (let i = 0; i < flags.length; i += 2) {
    const flag = flags[i];
    if (!["--root", "--input", "--output"].includes(flag) || !flags[i + 1] || Object.hasOwn(options, flag.slice(2))) fail("arguments");
    options[flag.slice(2)] = flags[i + 1];
  }
  if (action === "init" && Object.keys(options).length === 1 && options.root) await initializeRun(options.root);
  else if (action === "sanitize" && options.root) await sanitizeRun(options);
  else fail("arguments");
  process.stdout.write("Artefactos locales: operación completada.\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error instanceof ArtifactError ? error.message : "No se publicaron artefactos (error)."}\n`);
    process.exitCode = 1;
  });
}
