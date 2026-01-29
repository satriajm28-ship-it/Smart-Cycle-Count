import { GoogleGenAI } from "@google/genai";
import { AuditRecord } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeInventoryDiscrepancies = async (records: AuditRecord[]): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "API Key not configured. Please set the API_KEY environment variable.";
  }

  // Filter only items with variance to save tokens and focus analysis
  const discrepancies = records
    .filter(r => r.variance !== 0)
    .map(r => ({
      item: r.itemName,
      location: r.location,
      expected: r.systemQty,
      actual: r.physicalQty,
      variance: r.variance,
      batch: r.batchNumber,
      team: r.teamMember
    }));

  if (discrepancies.length === 0) {
    return "Great news! No discrepancies found in the current audit records. All physical counts match system records.";
  }

  const prompt = `
    Analyze the following inventory audit discrepancies from a Stock Opname.
    Provide a professional summary suitable for a warehouse manager.
    
    Data:
    ${JSON.stringify(discrepancies.slice(0, 50))} 
    (Top 50 records shown)

    Please include:
    1. A summary of the major losses or gains.
    2. Potential patterns (e.g., is a specific location or team member associated with errors?).
    3. Recommendations for process improvement.
    
    Keep it concise and actionable.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to generate analysis. Please try again later.";
  }
};