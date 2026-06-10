import { describe, expect, it } from "vitest";
import { isApprovedStatus, isFailedStatus } from "./types";

describe("isApprovedStatus", () => {
  it("reconhece status aprovados (case-insensitive)", () => {
    expect(isApprovedStatus("approved")).toBe(true);
    expect(isApprovedStatus("APPROVED")).toBe(true);
    expect(isApprovedStatus("paid")).toBe(true);
    expect(isApprovedStatus("accredited")).toBe(true);
  });
  it("rejeita status não aprovados", () => {
    expect(isApprovedStatus("pending")).toBe(false);
    expect(isApprovedStatus(null)).toBe(false);
    expect(isApprovedStatus(undefined)).toBe(false);
  });
});

describe("isFailedStatus", () => {
  it("reconhece falhas", () => {
    expect(isFailedStatus("rejected")).toBe(true);
    expect(isFailedStatus("cancelled")).toBe(true);
    expect(isFailedStatus("refunded")).toBe(true);
  });
  it("pendente não é falha", () => {
    expect(isFailedStatus("pending")).toBe(false);
    expect(isFailedStatus(null)).toBe(false);
  });
});
