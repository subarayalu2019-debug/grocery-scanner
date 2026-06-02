import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

app.post('/api/scan-bill', async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Configuration Error: GEMINI_API_KEY is missing on Render settings." });
        }

        // Initialize the new client SDK 
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const aiPrompt = `Look closely at this grocery bill image. Completely ignore store names, store addresses, phone numbers, cashiers, tax layout codes, payment methods, and receipt totals. Extract ONLY the true individual grocery items purchased. For each item, capture its clean name, quantity, and unit price. Calculate final_price as (quantity * price). Translate the item name into common spoken Tamil script. You must strictly match this structure schema precisely:
        {"english": [{"item": "Name", "qty": 1, "price": 10.00, "final_price": 10.00}], "tamil": [{"item": "பெயர்", "qty": 1, "price": 10.00, "final_price": 10.00}], "english_grand_total": 10.00, "tamil_grand_total": 10.00}`;

        // Fixed the SDK call to use the exact matching lowercase accessor methods (.models.generateContent)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                aiPrompt,
                {
                    inlineData: {
                        mimeType: mimeType || "image/jpeg",
                        data: image
                    }
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        // Pull out the clean JSON response payload string
        const cleanJsonText = response.text.trim();
        res.json(JSON.parse(cleanJsonText));

    } catch (error) {
        console.error("SDK processing crash log details:", error);
        res.status(500).json({ error: "The system vision engine failed to parse the layout structure smoothly." });
    }
});

app.listen(PORT, () => console.log(`Server running securely on port ${PORT}`));
