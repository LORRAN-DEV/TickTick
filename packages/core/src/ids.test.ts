import assert from "node:assert/strict";
import { test } from "node:test";
import { uuidv7 } from "./ids.ts";

test("formato UUID v7 com versão e variante corretas", () => {
  assert.match(uuidv7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("os primeiros 48 bits são o instante", () => {
  const t = Date.UTC(2040, 10, 24, 13, 0, 0); // no futuro: nenhum id anterior foi gerado depois disso
  const id = uuidv7(t);
  assert.equal(parseInt(id.slice(0, 8) + id.slice(9, 13), 16), t);
});

test("ids ordenam pelo tempo e nunca se repetem", () => {
  const t = Date.UTC(2030, 0, 1);
  assert.ok(uuidv7(t) < uuidv7(t + 1000));
  const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(t + 5000)));
  assert.equal(ids.size, 1000);
});

test("no mesmo milissegundo, cada id é maior que o anterior (monotônico)", () => {
  const t = Date.UTC(2031, 0, 1);
  const ids = Array.from({ length: 5000 }, () => uuidv7(t));
  for (let i = 1; i < ids.length; i++) assert.ok(ids[i]! > ids[i - 1]!, `id ${i} fora de ordem`);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("relógio que volta para trás não quebra a ordem", () => {
  const t = Date.UTC(2032, 0, 1);
  const a = uuidv7(t);
  const b = uuidv7(t - 10_000);
  assert.ok(b > a);
});
