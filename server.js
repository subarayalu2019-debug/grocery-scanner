
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

app.post('/api/scan-bill', async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        
        // Securely pulls your key from the Render dashboard environment setting
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Configuration Error: GEMINI_API_KEY is missing on Render settings." });
        }

        const aiPrompt = `Look closely at this grocery bill image. Completely ignore store names, addresses, cashiers, tax codes, payment layouts, and invoice totals. Extract ONLY the true individual grocery items purchased. For each item, capture its name, quantity, and unit price. Calculate final_price as (quantity * price). Translate the item name into common spoken Tamil script. Return ONLY a clean JSON object structure exactly matching this layout structure without markdown code blocks, triple backticks, or the word json: 
        {"english": [{"item": "Name", "qty": 1, "price": 10.00, "final_price": 10.00}], "tamil": [{"item": "பெயர்", "qty": 1, "price": 10.00, "final_price": 10.00}], "english_grand_total": 10.00, "tamil_grand_total": 10.00}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: aiPrompt },
                        { inlineData: { mimeType: mimeType || "image/jpeg", data: image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(400).json({ error: data.error.message });
        }

        // Clean out any unexpected markdown text Gemini might wrap around the response
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Safety check if it still contains a hidden text prefix
        if (rawText.startsWith("json")) {
            rawText = rawText.substring(4).trim();
        }

        res.json(JSON.parse(rawText));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "The server failed to parse the receipt data structure layout." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
