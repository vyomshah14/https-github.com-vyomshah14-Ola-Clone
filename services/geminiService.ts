import { GoogleGenAI, Type } from "@google/genai";
import { VehicleOption, RideType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Mock data to fallback if API fails or for speed
const MOCK_VEHICLES: VehicleOption[] = [
  { id: '1', type: RideType.BIKE, name: 'Moto', price: 65, currency: '₹', eta: 3, description: 'Affordable, fast', icon: 'bike' },
  { id: '2', type: RideType.AUTO, name: 'Auto', price: 110, currency: '₹', eta: 5, description: 'No bargaining', icon: 'zap' },
  { id: '3', type: RideType.CAB, name: 'GoCab', price: 240, currency: '₹', eta: 8, description: 'Comfy sedan', icon: 'car' },
  { id: '4', type: RideType.PREMIUM, name: 'Premium', price: 350, currency: '₹', eta: 10, description: 'Luxury rides', icon: 'star' },
];

export const getAddressSuggestions = async (query: string, locationContext: string = "Bangalore, India"): Promise<string[]> => {
  if (!query || query.length < 3) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate 5 realistic street addresses or landmark names near location (${locationContext}) that match the search query: "${query}". 
      Focus on popular places, streets, or areas in India.
      Return only a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini address error:", error);
    // Fallback simple suggestions
    return [`${query} Road`, `${query} Nagar`, `${query} Market`, `New ${query}`];
  }
};

export const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Identify a short, realistic street address or landmark for the coordinates ${lat}, ${lng} in India. Return ONLY the address string, no JSON.`,
    });
    return response.text?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export const calculateFares = async (pickup: string, dropoff: string): Promise<VehicleOption[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Estimate the distance and fair market price for a ride between "${pickup}" and "${dropoff}" in India. 
      Assume a standard city ride pricing model in Indian Rupees (INR).
      Return a JSON object with a list of options for Bike, Auto (Rickshaw/TukTuk), Cab (Standard), and Premium.
      Ensure prices are realistic numbers (integers).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  price: { type: Type.INTEGER },
                  eta: { type: Type.INTEGER, description: "Estimated arrival in minutes" }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    
    if (data.options && Array.isArray(data.options)) {
        // Map the AI response to our strong types
        return data.options.map((opt: any, index: number) => {
            let rType = RideType.CAB;
            let icon = 'car';
            let desc = 'Standard ride';
            
            const lowerType = opt.type.toLowerCase();
            if (lowerType.includes('bike') || lowerType.includes('moto')) { rType = RideType.BIKE; icon = 'bike'; desc = 'Beat the traffic'; }
            else if (lowerType.includes('auto') || lowerType.includes('rickshaw')) { rType = RideType.AUTO; icon = 'zap'; desc = 'Pocket friendly'; }
            else if (lowerType.includes('premium') || lowerType.includes('luxury')) { rType = RideType.PREMIUM; icon = 'star'; desc = 'Top rated drivers'; }

            return {
                id: `ride-${index}`,
                type: rType,
                name: opt.type,
                price: opt.price,
                currency: '₹',
                eta: opt.eta,
                description: desc,
                icon: icon
            };
        });
    }
    return MOCK_VEHICLES;
  } catch (error) {
    console.error("Fare calc error:", error);
    return MOCK_VEHICLES;
  }
};