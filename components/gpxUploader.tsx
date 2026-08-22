import { useState } from "react";
import { analyzeGpx } from "@/lib/parseGpx";

export default function GpxUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] || null);
    setError('');
  };  
  
  const handleFileUpload = async () => {
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Please select a file smaller than 10MB.');
      return;
    }

    setIsLoading(true);

    try {
      const xml = await selectedFile.text();

      const ride = analyzeGpx(xml);

      console.log(ride);
    } catch (error) {
      setError('Error processing file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".gpx" onChange={handleFileChange} />
      <button onClick={handleFileUpload} disabled={!selectedFile || isLoading}>
        {isLoading ? 'Uploading...' : 'Upload GPX File'}
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
