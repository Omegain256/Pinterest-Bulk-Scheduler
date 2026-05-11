const OpenAI = require('openai');

const nvidiaKey = "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";

async function testNvidia() {
    console.log("Testing NVIDIA Minimax API...");
    const startTime = Date.now();
    
    try {
        const client = new OpenAI({
            apiKey: nvidiaKey,
            baseURL: "https://integrate.api.nvidia.com/v1"
        });

        const completion = await client.chat.completions.create({
            model: "minimaxai/minimax-m2.7",
            messages: [{ role: "user", content: "Write a short Pinterest title for a summer outfit." }],
            temperature: 0.7,
            max_tokens: 100,
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`Success! Time taken: ${duration}s`);
        console.log("Full Response:", JSON.stringify(completion, null, 2));
    } catch (err) {
        console.error("API Call Failed:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        }
    }
}

testNvidia();
