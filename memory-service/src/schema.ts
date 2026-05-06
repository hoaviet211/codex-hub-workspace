import { readFile } from "node:fs/promises";

export async function loadSchemaSql(): Promise<string> {
  const url = new URL("../migrations/001_init.sql", import.meta.url);
  return readFile(url, "utf8");
}
