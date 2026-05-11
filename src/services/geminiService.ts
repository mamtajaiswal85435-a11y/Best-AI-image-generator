import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
};

export interface StorySummary {
  characterDescription: string;
  scenes: {
    paragraph: string;
    imagePrompt: string;
  }[];
}

export async function analyzeStory(story: string, maxImages: number): Promise<StorySummary> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Analyze the following story and:
      1. Identify the main character and create a detailed visual description for image generation (include age, hair color, clothing style, facial features). This will be used to maintain consistency.
      2. Split the story into at most ${maxImages} meaningful scenes based on paragraphs.
      3. For each scene, write an image generation prompt that combines the character description with the specific action or environment of that paragraph.

      Story:
      ${story}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characterDescription: {
            type: Type.STRING,
            description: "Detailed visual description of the main character."
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                paragraph: { type: Type.STRING },
                imagePrompt: { type: Type.STRING, description: "Detailed prompt for image generation, including the character description." }
              },
              required: ["paragraph", "imagePrompt"]
            }
          }
        },
        required: ["characterDescription", "scenes"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as StorySummary;
}

export async function generateImage(prompt: string, aspectRatio: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [{ text: prompt }],
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image was generated.");
}
