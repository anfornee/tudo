import test from "node:test";
import assert from "node:assert/strict";

const { parseRouteXml } = await import("./import.ts");

test("imports GPX 1.1 tracks with multiple segments and elevation", () => {
  const result = parseRouteXml(`<?xml version="1.0"?>
    <gpx version="1.1" creator="Strava"><trk><name>Morning Hills</name><desc>Steady ride</desc>
      <trkseg><trkpt lat="38" lon="-77"><ele>10</ele></trkpt><trkpt lat="38.01" lon="-76.99"><ele>30</ele></trkpt></trkseg>
      <trkseg><trkpt lat="38.02" lon="-76.98"><ele>40</ele></trkpt><trkpt lat="38.03" lon="-76.97"><ele>35</ele></trkpt></trkseg>
    </trk></gpx>`, "strava.gpx");

  assert.equal(result.format, "gpx");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].name, "Morning Hills");
  assert.equal(result.candidates[0].source.label, "Strava GPX");
  assert.deepEqual(result.candidates[0].route.segmentStartIndices, [0, 2]);
  assert.equal(result.candidates[0].route.geometry.length, 4);
  assert.equal(result.candidates[0].route.elevationGainMeters, 20);
  assert.equal(result.candidates[0].route.elevationLossMeters, 5);
});

test("surfaces every GPX track and route instead of discarding content", () => {
  const result = parseRouteXml(`<gpx version="1.0" creator="RideWithGPS">
    <trk><name>Track A</name><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk>
    <rte><name>Route B</name><rtept lat="3" lon="4"><name>Start</name></rtept><rtept lat="3.1" lon="4.1"><name>Left</name><type>Left</type></rtept></rte>
  </gpx>`, "routes.gpx");

  assert.deepEqual(result.candidates.map(({ name }) => name), ["Track A", "Route B"]);
  assert.equal(result.candidates[1].route.maneuvers.length, 2);
  assert.equal(result.candidates[1].route.maneuvers[1].type, "left");
});

test("imports TCX courses, tracks, and course points", () => {
  const result = parseRouteXml(`<?xml version="1.0"?>
    <TrainingCenterDatabase><Courses><Course><Name>River Loop</Name><Notes>Easy spin</Notes><Track>
      <Trackpoint><Position><LatitudeDegrees>38</LatitudeDegrees><LongitudeDegrees>-77</LongitudeDegrees></Position><AltitudeMeters>12</AltitudeMeters></Trackpoint>
      <Trackpoint><Position><LatitudeDegrees>38.01</LatitudeDegrees><LongitudeDegrees>-76.99</LongitudeDegrees></Position><AltitudeMeters>18</AltitudeMeters></Trackpoint>
    </Track><CoursePoint><Name>Turn</Name><Position><LatitudeDegrees>38.01</LatitudeDegrees><LongitudeDegrees>-76.99</LongitudeDegrees></Position><PointType>Right</PointType></CoursePoint>
    </Course></Courses></TrainingCenterDatabase>`, "course.tcx");

  assert.equal(result.format, "tcx");
  assert.equal(result.candidates[0].name, "River Loop");
  assert.equal(result.candidates[0].description, "Easy spin");
  assert.equal(result.candidates[0].route.provider.provider, "tcx");
  assert.equal(result.candidates[0].route.maneuvers[0].type, "right");
});

test("rejects malformed, unsafe, invalid, and empty route files", () => {
  assert.throws(() => parseRouteXml("<gpx>", "bad.gpx"), /malformed XML/);
  assert.throws(() => parseRouteXml('<!DOCTYPE gpx [<!ENTITY x "bad">]><gpx version="1.1"/>', "bad.gpx"), /not allowed/);
  assert.throws(() => parseRouteXml('<gpx version="1.1"><trk><trkseg><trkpt lat="999" lon="2"/><trkpt lat="1" lon="2"/></trkseg></trk></gpx>', "bad.gpx"), /invalid track coordinate/);
  assert.throws(() => parseRouteXml("not a route", "route.txt"), /malformed XML|GPX or TCX/);
});
