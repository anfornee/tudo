import { analyzeGpx } from "@/lib/parseGpx";

export default function GpxUploader() {
  const handleGpxUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const xml = await file.text();

      const ride = analyzeGpx(xml);

      console.log(ride);
    } catch (error) {
      console.error("Failed to analyze GPX:", error);
    }
  };

  return (
    <input
      type="file"
      accept=".gpx,application/gpx+xml"
      onChange={handleGpxUpload}
    />
  );
}
