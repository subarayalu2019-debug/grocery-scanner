 
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

app.post('/api/scan-bill', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: "Missing bill image data payload." });
        }

        // Dynamically import the puter-node library
        const { default: puter } = await import('@puter/sdk');

        // Step 1: AI Prompt instructing Puter to analyze the image text structure
        const prompt = `Analyze the text inside this grocery receipt image. Extract all line items, their individual quantities, and unit prices. Calculate the final price as (quantity * price). Return ONLY a strict JSON object matching this structure exactly without backticks or markdown formatting wrappers: 
        {"items": [{"name": "string", "qty": number, "price": number, "final_price": number}]}`;

        // Convert the base64 image data string into a buffer object for the SDK
        const imageBuffer = Buffer.from(image, 'base64');

        // Puter AI reads the image text safely without any API keys or configuration settings
        const aiResponse = await puter.ai.chat(prompt, imageBuffer);
        let rawText = aiResponse.toString().replace(/```json/g, "").replace(/```/g, "").trim();
        const parsedData = JSON.parse(rawText);

        // Step 2: Loop through and translate names to Tamil via Puter's text processing model
        let englishItems = [];
        let tamilItems = [];
        let grandTotal = 0;

        for (let item of parsedData.items) {
            const qty = Number(item.qty) || 1;
            const price = Number(item.price) || 0;
            const finalPrice = qty * price;
            grandTotal += finalPrice;

            englishItems.push({
                item: item.name,
                qty: qty,
                price: price,
                final_price: finalPrice
            });

            // Translate item name dynamically to clean Tamil script
            let tamilName = item.name;
            try {
                const translationPrompt = `Translate this grocery item name to clean Tamil script. Reply with ONLY the translated name: "${item.name}"`;
                const translationResponse = await puter.ai.chat(translationPrompt);
                tamilName = translationResponse.toString().trim();
            } catch(e) {
                console.log("Translation fallback engaged.");
            }

            tamilItems.push({
                item: tamilName,
                qty: qty,
                price: price,
                final_price: finalPrice
            });
        }

        // Package structural data to match your frontend tables format perfectly
        res.json({
            english: englishItems,
            tamil: tamilItems,
            english_grand_total: grandTotal,
            tamil_grand_total: grandTotal
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal keyless backend engine failed to parse image layout." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));