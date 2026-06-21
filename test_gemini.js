const fs = require('fs');
const path = require('path');

// Manual parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    });
}

async function testGeminiOpenAI() {
  const apiKey = env.GEMINI_API_KEY;
  console.log('Testing with GEMINI_API_KEY:', apiKey ? apiKey.substring(0, 8) + '...' : 'undefined');
  
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Output a JSON block with key "hello" containing "world".' },
          { role: 'user', content: 'Say hello!' }
        ],
        response_format: { type: 'json_object' }
      })
    });

    console.log('Response Status:', res.status);
    const text = await res.text();
    console.log('Response Body:', text);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testGeminiOpenAI();
