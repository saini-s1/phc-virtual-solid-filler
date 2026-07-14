import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalFileIngredientStore } from "../store.js";

describe("LocalFileIngredientStore", () => {
  let dir;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("add() then list() round-trips an ingredient, remove() deletes only that one", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "ingredient-store-"));
    const store = new LocalFileIngredientStore(path.join(dir, "customIngredients.json"));

    const a = await store.add({ name: "A", caloriesPer100g: 1, per100g: {} });
    const b = await store.add({ name: "B", caloriesPer100g: 2, per100g: {} });

    expect(a.id).toBeTruthy();
    expect(await store.list()).toHaveLength(2);

    const removed = await store.remove(a.id);
    expect(removed).toBe(true);

    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(b.id);
  });

  it("remove() returns false for an id that doesn't exist", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "ingredient-store-"));
    const store = new LocalFileIngredientStore(path.join(dir, "customIngredients.json"));
    expect(await store.remove("not-a-real-id")).toBe(false);
  });
});
