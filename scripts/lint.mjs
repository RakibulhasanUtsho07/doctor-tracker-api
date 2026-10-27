import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "test", "scripts"];
const files = [];
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".mjs"))) files.push(fullPath);
  }
}

const failures = [];
for (const root of roots) {
  try { await collect(root); }
  catch (error) {
    const detail = error instanceof Error ? error.message : "unknown filesystem error";
    failures.push(`${root}: unable to inspect source tree (${detail})`);
  }
}
for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  if (!content.endsWith("\n")) failures.push(`${file}: missing final newline`);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/[ \t]+$/.test(line.replace(/\r$/, ""))) failures.push(`${file}:${lineNumber}: trailing whitespace`);
    if (line.startsWith("\t")) failures.push(`${file}:${lineNumber}: use spaces instead of tab indentation`);
    if (/\bconsole\s*\.\s*log\s*\(/.test(line)) failures.push(`${file}:${lineNumber}: remove debug console.log calls`);
    if (/\bdebugger\s*;?/.test(line)) failures.push(`${file}:${lineNumber}: remove debugger statements`);
  });
}
if (failures.length > 0) {
  process.stderr.write(`Source hygiene lint failed with ${failures.length} issue(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Source hygiene lint passed for ${files.length} source file(s).\n`);
}
