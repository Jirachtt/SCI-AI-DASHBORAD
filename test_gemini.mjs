const API_KEY = 'AIzaSyA60bIf7WQrTynTxQ9o8hk5NiLgeCJVzIs';

async function testModel(version, model) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${API_KEY}`;
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'สวัสดี ตอบสั้นๆ 1 ประโยค' }] }],
                generationConfig: { maxOutputTokens: 50 }
            }),
            signal: controller.signal
        });
        const data = await res.json();
        if (res.ok && data.candidates) {
            console.log(`✅ ${version}/${model} -> WORKS! Response: "${data.candidates[0]?.content?.parts?.[0]?.text?.substring(0, 50)}"`);
            return true;
        } else {
            console.log(`❌ ${version}/${model} -> ${res.status}: ${data.error?.message?.substring(0, 80) || 'Unknown'}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${version}/${model} -> ${e.name === 'AbortError' ? 'TIMEOUT' : e.message}`);
        return false;
    }
}

async function main() {
    console.log('Testing Gemini API Key...\n');

    const tests = [
        ['v1beta', 'gemini-2.0-flash'],
        ['v1beta', 'gemini-1.5-flash-latest'],
        ['v1beta', 'gemini-1.5-flash'],
        ['v1beta', 'gemini-1.5-pro-latest'],
        ['v1beta', 'gemini-pro'],
        ['v1', 'gemini-2.0-flash'],
        ['v1', 'gemini-1.5-flash'],
        ['v1', 'gemini-1.5-pro'],
        ['v1', 'gemini-pro'],
    ];

    for (const [ver, model] of tests) {
        await testModel(ver, model);
    }
    console.log('\nDone!');
}

main();
