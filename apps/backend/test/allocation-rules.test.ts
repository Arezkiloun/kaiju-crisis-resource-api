import test from "node:test";
import assert from "node:assert/strict";
import { AllocationRulesService } from "../src/resources/allocation-rules.service";

const service = new AllocationRulesService();

test("30% de 12 donne une rétention minimale de 4", () => {
  assert.equal(service.calculateMinimumRetention(12, 30), 4);
});

test("30% de 5 est arrondi à 2", () => {
  assert.equal(service.calculateMinimumRetention(5, 30), 2);
});

test("15% de 12 est arrondi à 2", () => {
  assert.equal(service.calculateMinimumRetention(12, 15), 2);
});

test("quantité disponible correcte", () => {
  assert.equal(service.calculateAvailableQuantity(12, 4), 8);
});

test("la disponibilité ne devient jamais négative", () => {
  assert.equal(service.calculateAvailableQuantity(2, 4), 0);
});
