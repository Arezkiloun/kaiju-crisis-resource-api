import test from "node:test";
import assert from "node:assert/strict";
import {
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "../src/generated/prisma/enums";
import {
  assertCanRequestDirectTransfer,
  assertCanOrganizeTransit,
} from "../src/resources/transfer-rules";

test("QC peut demander un transfert adjacent au niveau 3", () => {
  assert.doesNotThrow(() => {
    assertCanRequestDirectTransfer(Role.QC, true, 3);
  });
});

test("transfert adjacent interdit au niveau 2", () => {
  assert.throws(
    () =>
      assertCanRequestDirectTransfer(
        Role.QC,
        true,
        2,
      ),
    ConflictException,
  );
});

test("LC peut organiser un transit au niveau 4", () => {
  assert.doesNotThrow(() => {
    assertCanOrganizeTransit(Role.LC, 4);
  });
});

test("QC ne peut pas organiser un transit au niveau 4", () => {
  assert.throws(
    () => assertCanOrganizeTransit(Role.QC, 4),
    ForbiddenException,
  );
});

test("CD peut organiser un transit au niveau 5", () => {
  assert.doesNotThrow(() => {
    assertCanOrganizeTransit(Role.CD, 5);
  });
});

test("transit interdit avant le niveau 4", () => {
  assert.throws(
    () => assertCanOrganizeTransit(Role.LC, 3),
    ConflictException,
  );
});
