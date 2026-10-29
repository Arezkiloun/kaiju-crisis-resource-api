import test from "node:test";
import assert from "node:assert/strict";
import {
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "../src/generated/prisma/enums";
import { assertCanReserve } from "../src/resources/reservation-rules";

test("QC peut réserver dans son district au niveau 2", () => {
  assert.doesNotThrow(() => {
    assertCanReserve(Role.QC, true, 2);
  });
});

test("réservation interdite au niveau 1", () => {
  assert.throws(
    () => assertCanReserve(Role.QC, true, 1),
    ConflictException,
  );
});

test("LC ne peut pas faire une réservation QC", () => {
  assert.throws(
    () => assertCanReserve(Role.LC, true, 3),
    ForbiddenException,
  );
});

test("QC ne peut pas réserver dans un autre district", () => {
  assert.throws(
    () => assertCanReserve(Role.QC, false, 3),
    ForbiddenException,
  );
});
