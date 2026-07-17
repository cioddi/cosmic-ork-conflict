import { createId } from "./createId";

test("uses randomUUID when the browser provides it", () => {
  expect(
    createId("unit", {
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    })
  ).toBe("00000000-0000-4000-8000-000000000001");
});

test("creates an RFC 4122 version 4 ID when randomUUID is unavailable", () => {
  expect(
    createId("unit", {
      getRandomValues: <T extends Exclude<BufferSource, ArrayBuffer>>(values: T): T => {
        if (values instanceof Uint8Array) values.fill(0xab);
        return values;
      },
    })
  ).toBe("abababab-abab-4bab-abab-abababababab");
});

test("has a dependency-free fallback for legacy non-secure contexts", () => {
  const first = createId("unit", null);
  const second = createId("unit", null);

  expect(first).toMatch(/^unit-/);
  expect(second).toMatch(/^unit-/);
  expect(second).not.toBe(first);
});
