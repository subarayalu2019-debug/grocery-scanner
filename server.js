const express = require('express');
const path = require('path');
const Tesseract = require('tesseract.js');

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

        // Convert base64 image string into a clean buffer
        const imageBuffer = Buffer.from(image, 'base64');

        // Tesseract scans the image text directly on Render's server for free
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');

        // Split text into readable lines for your frontend tables
        const lines = text.split('\n').filter(line => line.trim().length > 3);
        
        let englishItems = [];
        let tamilItems = [];
        let grandTotal = 0;

        // Loop through lines to find names and prices
        lines.forEach((line, index) => {
            // Find numbers at the end of lines for pricing
            const matches = line.match(/(\d+[\.,]\d{2})/);
            let price = matches ? parseFloat(matches[1].replace(',', '.')) : 2.50; // default backup price
            let cleanName = line.replace(/[^a-zA-Z\s]/g, "").trim() || `Item ${index + 1}`;

            if (cleanName.length > 3) {
                grandTotal += price;
                
                englishItems.push({
                    item: cleanName,
                    qty: 1,
                    price: price,
                    final_price: price
                });

                // Simple fallback text structure for your side-by-side Tamil table
                tamilItems.push({
                    item: `பொருள் - ${cleanName}`, // Label helper
                    qty: 1,
                    price: price,
                    final_price: price
                });
            }
        });

        res.json({
            english: englishItems,
            tamil: tamilItems,
            english_grand_total: grandTotal,
            tamil_grand_total: grandTotal
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal scanner failed to read the image text lines." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
