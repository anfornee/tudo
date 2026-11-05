import test from "node:test";
import assert from "node:assert/strict";

const { cursorFromSample, nearestRideSampleIndex, createRouteCursorResolver } = await import("./cursor.ts");

const samples = [
  { elapsedSeconds: 0, distanceMiles: 0, latitude: 51, longitude: -1 },
  { elapsedSeconds: 2, distanceMiles: 0.01, latitude: 51.001, longitude: -1.001 },
  { elapsedSeconds: 8, distanceMiles: 0.03, latitude: 51.002, longitude: -1.002 },
].map((sample) => ({ ...sample, power: null, speedMph: null, cadence: null, elevationFeet: null }));

test("resolves irregular elapsed and distance positions to the nearest sample", () => {
  assert.equal(nearestRideSampleIndex(samples, 5), 1);
  assert.equal(nearestRideSampleIndex(samples, 0.028, "distanceMiles"), 2);
  assert.deepEqual(cursorFromSample(samples[1], 1), { sampleIndex: 1, timestampMs: null, distanceMiles: 0.01 });
});

test("route resolver handles repeated coordinates and preserves source indexes", () => {
  const resolver = createRouteCursorResolver([[[-1, 51], [-1.001, 51.001], [-1.002, 51.002]]], samples);
  assert.equal(resolver.cursorAt(-1.001, 51.001)?.sampleIndex, 1);
  assert.equal(resolver.cursorAt(-1.002, 51.002)?.sampleIndex, 2);
});

test("route geometry resolves and positions old samples without stored GPS", () => {
  const oldSamples = [
    { ...samples[0], distanceMiles: 0, latitude: undefined, longitude: undefined },
    { ...samples[1], distanceMiles: 0.5, latitude: undefined, longitude: undefined },
    { ...samples[2], distanceMiles: 1, latitude: undefined, longitude: undefined },
  ];
  const resolver = createRouteCursorResolver([[[-1, 51], [-1.001, 51.001], [-1.002, 51.002]]], oldSamples);
  assert.equal(resolver.cursorAt(-1.001, 51.001)?.sampleIndex, 1);
  const coordinate = resolver.coordinateAt(cursorFromSample(oldSamples[1], 1));
  assert.ok(coordinate);
  assert.ok(Math.abs(coordinate[0] - -1.001) < 0.0001);
});

test("missing metric values do not prevent cursor resolution", () => {
  const withGap = [{ ...samples[0], distanceMiles: null }, ...samples.slice(1)];
  assert.equal(nearestRideSampleIndex(withGap, 0.015, "distanceMiles"), 1);
});
