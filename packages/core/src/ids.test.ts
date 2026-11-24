import assert from "node:assert/strict";
import { test } from "node:test";
import { uuidv7 } from "./ids.ts";

test("formato UUID v7 com versão e variante corretas", () => {
  assert.match(uuidv7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("os primeiros 48 bits são o instante", () => {
  const t = Date.UTC(2026, 10, 24, 13, 0, 0);
  const id = uuidv7(t);
  assert.equal(parseInt(id.slice(0, 8) + id.slice(9, 13), 16), t);
});

test("ids de instantes diferentes ordenam pelo tempo, e nunca se repetem", () => {
  assert.ok(uuidv7(1000) < uuidv7(2000));
  const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(5000)));
  assert.equal(ids.size, 1000);
});
