import { useState } from "react";
import { analyzeGpx } from "@/lib/parseGpx";
import { parseZwiftFit } from "@/lib/parseFit";

export default function RideUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    setSelectedFile(file);
    setError("");
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File is too large. Please select a file smaller than 10MB.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const extension = selectedFile.name.split(".").pop()?.toLowerCase();

      let ride;

      if (extension === "fit") {
        const buffer = await selectedFile.arrayBuffer();

        ride = await parseZwiftFit(buffer);
      } else if (extension === "gpx") {
        const xml = await selectedFile.text();

        ride = analyzeGpx(xml);
      } else {
        throw new Error("Unsupported file type.");
      }

      console.log(ride);
    } catch (error) {
      console.error(error);
      setError(
        "Error processing file. Please make sure the file is a valid GPX or FIT activity.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".gpx,.fit" onChange={handleFileChange} />

      <button onClick={handleFileUpload} disabled={!selectedFile || isLoading}>
        {isLoading ? "Processing..." : "Upload Ride"}
      </button>

      {error && <p>{error}</p>}
    </div>
  );
}
