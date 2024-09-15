import { useEffect, useState } from "react";
import { supabase } from "./utils/supabase";

function App() {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [imageList, setImageList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const apiHost = "https://api.stability.ai";
  const engineId = "stable-diffusion-v1-6";
  const apiKey = import.meta.env.VITE_STABLITY_API_KEY;

  useEffect(() => {
    fetchImage();
  }, []);

  async function fetchImage() {
    const { data, error } = await supabase.storage
      .from("generate-image")
      .list();

    if (error) {
      console.error("Error fetching images", error);
      return;
    }

    if (data) {
      const imageUrls = await Promise.all(
        data.map(async (image) => {
          if (image.name === ".emptyFolderPlaceholder") {
            return "";
          }
          const { data: signedUrlData, error: signedUrlError } =
            await supabase.storage
              .from("generate-image")
              .createSignedUrl(image.name, 60);
          if (signedUrlError) {
            console.error("Error createing signed url", signedUrlError);
            return "";
          }

          return signedUrlData?.signedUrl ?? "";
        })
      );

      setImageList(imageUrls.filter((url) => url !== ""));
    }
  }

  const handleGenerateImage = async () => {
    setIsLoading(true);
    const response = await fetch(
      `${apiHost}/v1/generation/${engineId}/text-to-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
            },
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: 1,
        }),
      }
    );

    if (!response.ok) {
      setIsLoading(false);
      throw Error("Failed to generate image");
    }

    const responseJson = await response.json();
    const base64Image = responseJson.artifacts[0].base64;
    setIsLoading(false);
    setGeneratedImage(`data:image/png;base64,${base64Image}`);
  };

  const handleSaveImage = async () => {
    if (!generatedImage) {
      return;
    }

    const fileName = `${prompt}.png`;
    const base64Data = generatedImage.replace(/^data:image\/png;base64,/, "");

    const binaryData = Uint8Array.from(atob(base64Data), (char) =>
      char.charCodeAt(0)
    );

    const { error } = await supabase.storage
      .from("generate-image")
      .upload(fileName, binaryData.buffer, {
        contentType: "image/png",
      });

    if (error) {
      console.log("Error uploading image");
      return;
    }

    console.log("Image uploaded successfully");
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white p-8">
        <h1 className="text-6xl text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-ping-600 font-extrabold tracking-wide my-8">
          AI Image Generator
        </h1>
        <div className="flex justify-center mb-8">
          <div className="flex flex-col sm:flex-row gap-2 bg-gray-800 rounded-lg shadow-lg w-full max-w-xl">
            <input
              type="text"
              className="flex-grow p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purpule-500 transition"
              placeholder="Describe your imagination..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-mdhover:opacity-80transition-opacity disabled:opacity-50 flex items-center justify-center"
              onClick={handleGenerateImage}
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 border-4 border-white rounded-full border-t-transparent"></div>
              ) : (
                <>Generate</>
              )}
            </button>
          </div>
        </div>
        <div className="mb-12 transition-all duration-500 ease-in-out max-w-xl mx-auto">
          <div className="relative group aspect-square shadow-xl">
            {generatedImage ? (
              <img
                src={generatedImage}
                alt="Generated Image"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center text-xl">
                Let's Generate
              </div>
            )}
            {generatedImage && (
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  className="bg-white bg-opacity-20 backdrop-filter backdrop-blur-sm p-4 rounded-full shadow-md hover:bg-opacity-30 transition-all duration-300"
                  onClick={handleSaveImage}
                >
                  ★
                </button>
              </div>
            )}
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-6 flex items-center max-w-xl mx-auto">
          Your Imagination Gallery
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-xl mx-auto">
          {imageList.map((imageUrl, index) => (
            <div
              key={index}
              className="relative group aspect-square overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:scale-105"
            >
              <img
                src={imageUrl}
                alt={`Gallery ${index}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default App;
