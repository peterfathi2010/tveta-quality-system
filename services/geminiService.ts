
import { GoogleGenAI, Type } from "@google/genai";
import { ChecklistItem, ChecklistItemStatus } from "../types";

// Always use process.env.GEMINI_API_KEY for the Gemini API in this environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeAuditFindings = async (findings: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `قم بتحليل الملاحظات التالية واقترح إجراءات تصحيحية (Corrective Actions) وتصنيفها حسب الخطورة: \n\n ${findings}`,
      config: {
        systemInstruction: "أنت خبير جودة متخصص في مواصفات ISO 9001 ومراجعة الأنظمة التقنية والمهنية.",
        temperature: 0.7,
      },
    });
    return response.text || "لم يتم استلام أي نص من التحليل.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "عذراً، حدث خطأ أثناء تحليل البيانات. يرجى المحاولة لاحقاً.";
  }
};

export const getQualityAdvice = async (query: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: query,
      config: {
        systemInstruction: "أنت مساعد ذكي متخصص في أنظمة إدارة الجودة (QMS) والمراجعة الداخلية والخارجية. أجب باللغة العربية بمهنية واحترافية.",
      },
    });
    const text = response.text;
    return text ? text : "عذراً، لم أتمكن من إنشاء إجابة في الوقت الحالي.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "لا يمكنني الوصول إلى خادم الذكاء الاصطناعي حالياً.";
  }
};

export const generateAuditChecklist = async (topic: string): Promise<ChecklistItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create a comprehensive quality audit checklist for: ${topic}. Focus on safety, compliance, and efficiency.`,
      config: {
        systemInstruction: "You are a Quality Assurance expert. Generate a list of audit checklist items. Return JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The audit question or check item" },
              description: { type: Type.STRING, description: "Detailed explanation of what to look for" },
              category: { type: Type.STRING, description: "Category of the check (e.g., Safety, Hygiene, Documentation)" },
            },
            required: ["question", "description", "category"]
          }
        }
      },
    });

    const items = JSON.parse(response.text || '[]');
    
    return items.map((item: { question: string; description: string; category: string }, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      question: item.question,
      description: item.description,
      category: item.category,
      status: ChecklistItemStatus.PENDING
    }));
  } catch (error) {
    console.error("Gemini Checklist Generation Error:", error);
    return [];
  }
};

export const analyzeDefect = async (description: string, context: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Analyze this defect found during an audit.\nDefect: ${description}\nAudit Context: ${context}`,
      config: {
        systemInstruction: "You are a Root Cause Analysis expert. Analyze the defect, identify the likely root cause, and suggest a Corrective and Preventive Action (CAPA). Return JSON.",
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
             analysis: { type: Type.STRING, description: "Root cause analysis" },
             recommendation: { type: Type.STRING, description: "Recommended corrective action" }
           },
           required: ["analysis", "recommendation"]
        }
      },
    });
    
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Defect Analysis Error:", error);
    return { 
      analysis: "Could not perform analysis at this time.", 
      recommendation: "Please review manually." 
    };
  }
};

// --- Smart Document Analysis ---
export const analyzeDocumentImage = async (base64Image: string): Promise<{ title?: string; governorate?: string }> => {
  try {
    // Note: 'gemini-3-flash-preview' supports multimodal input (images + text)
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this official report document. Extract the 'title' (Subject of the report) and the 'governorate' (Egyptian Governorate name) if mentioned. If not found, return empty strings. Return JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            governorate: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Document Analysis Error:", error);
    return {};
  }
};

// --- NEW: Smart Form Generator ---
export const generateSmartFormSchema = async (topic: string): Promise<Record<string, unknown> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Create a data collection form schema for: ${topic}. Include a title, description, and a list of fields. Fields should have labels, types (text, number, date, select, checkbox, textarea), and options if type is select.`,
      config: {
        systemInstruction: "You are a Form Designer. Generate a JSON schema for a dynamic form. Ensure field types are strictly one of: 'text', 'number', 'date', 'textarea', 'select', 'checkbox'. Use Arabic for labels.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  type: { type: Type.STRING },
                  required: { type: Type.BOOLEAN },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["label", "type", "required"]
              }
            }
          },
          required: ["title", "description", "fields"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Form Generation Error:", error);
    return null;
  }
};
