// Custom ingredient library store. Two implementations behind one small interface:
//   - AzureTableIngredientStore: used in Azure when AZURE_STORAGE_CONNECTION_STRING is set.
//     Table Storage is intentionally simple/cheap for a prototype (no relational needs).
//   - LocalFileIngredientStore: local dev fallback, JSON file on disk (gitignored).
//
// Both expose: list() -> Promise<StoredIngredient[]>, add(ingredient) -> Promise<StoredIngredient>,
// remove(id) -> Promise<boolean> (true if something was actually deleted). There is deliberately no
// way to remove the built-in 16 template ingredients (src/nutrition/data/ingredientLibrary.ts) —
// those never go through this store, only ones a user saved.
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TABLE_NAME = "CustomIngredients";
const PARTITION_KEY = "ingredient";

class LocalFileIngredientStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async #read() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async #write(rows) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(rows, null, 2), "utf8");
  }

  async list() {
    return this.#read();
  }

  async add(ingredient) {
    const rows = await this.#read();
    const stored = { id: randomUUID(), createdAt: new Date().toISOString(), ...ingredient };
    rows.push(stored);
    await this.#write(rows);
    return stored;
  }

  async remove(id) {
    const rows = await this.#read();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await this.#write(next);
    return true;
  }
}

class AzureTableIngredientStore {
  constructor(client) {
    this.client = client;
  }

  static async create(connectionString, tableName) {
    // Lazy import: @azure/data-tables is only needed when this store is selected, so
    // local dev without the package installed (or without cloud creds) never pays for it.
    const { TableClient } = await import("@azure/data-tables");
    const client = TableClient.fromConnectionString(connectionString, tableName, {
      allowInsecureConnection: connectionString.includes("UseDevelopmentStorage=true"),
    });
    await client.createTable();
    return new AzureTableIngredientStore(client);
  }

  async list() {
    const out = [];
    for await (const entity of this.client.listEntities()) {
      out.push({
        id: entity.rowKey,
        createdAt: entity.createdAt,
        name: entity.name,
        tradeName: entity.tradeName || undefined,
        cas: entity.cas || undefined,
        gcas: entity.gcas || undefined,
        caloriesPer100g: entity.caloriesPer100g,
        per100g: JSON.parse(entity.per100gJson || "{}"),
      });
    }
    return out;
  }

  async add(ingredient) {
    const rowKey = randomUUID();
    const createdAt = new Date().toISOString();
    await this.client.createEntity({
      partitionKey: PARTITION_KEY,
      rowKey,
      name: ingredient.name,
      tradeName: ingredient.tradeName || "",
      cas: ingredient.cas || "",
      gcas: ingredient.gcas || "",
      caloriesPer100g: ingredient.caloriesPer100g,
      per100gJson: JSON.stringify(ingredient.per100g || {}),
      createdAt,
    });
    return { id: rowKey, createdAt, ...ingredient };
  }

  async remove(id) {
    try {
      await this.client.deleteEntity(PARTITION_KEY, id);
      return true;
    } catch (err) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }
}

/** Picks the store based on environment: Azure Table Storage in the cloud, a local JSON file otherwise. */
export async function createIngredientStore(env = process.env) {
  const connectionString = env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    const tableName = env.AZURE_STORAGE_TABLE_NAME || DEFAULT_TABLE_NAME;
    return AzureTableIngredientStore.create(connectionString, tableName);
  }
  const filePath = path.join(__dirname, "data", "customIngredients.json");
  return new LocalFileIngredientStore(filePath);
}

export { LocalFileIngredientStore, AzureTableIngredientStore };
