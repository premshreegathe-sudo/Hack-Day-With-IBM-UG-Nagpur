'use strict';

const fs = require('fs');

/**
 * Demo component list shown when no API key is configured.
 * Clearly labelled as demo data — never presented as real AI output.
 */
const DEMO_COMPONENTS = [
  { name: 'Arduino UNO', confidence: null, source: 'demo' },
  { name: 'Breadboard', confidence: null, source: 'demo' },
  { name: 'LED', confidence: null, source: 'demo' },
  { name: 'Jumper Wires', confidence: null, source: 'demo' },
  { name: '220Ω Resistor', confidence: null, source: 'demo' }
];

/**
 * Analyse an uploaded image for electronic components.
 *
 * If VISION_API_KEY (watsonx) or OPENAI_API_KEY is configured, calls the live API.
 * Otherwise returns demo data clearly labelled as such.
 *
 * @param {string} imagePath - Absolute path to the uploaded image file.
 * @returns {Promise<{components, mode, disclaimer}>}
 */
async function analyzeImage(imagePath) {
  const openAIKey = process.env.OPENAI_API_KEY;

  if (openAIKey) {
    return analyzeWithOpenAI(imagePath, openAIKey);
  }

  // No credentials — return demo mode
  return {
    mode: 'demo',
    disclaimer:
      'No AI API key is configured. These are example components for demonstration purposes only. ' +
      'Configure OPENAI_API_KEY in your .env file to enable real image analysis.',
    components: DEMO_COMPONENTS
  };
}

/**
 * Analyse image using OpenAI GPT-4 Vision API.
 */
async function analyzeWithOpenAI(imagePath, apiKey) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = imagePath.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const prompt = `You are an expert electronics component identifier. Carefully examine this image and identify all visible electronic components.

Focus on:
- Arduino boards (UNO, Nano, Mega, etc.)
- Sensors (DHT11, DHT22, HC-SR04, PIR, soil moisture, etc.)
- Modules (Bluetooth, WiFi, motor driver, relay, etc.)
- Passive components (resistors, capacitors, LEDs, buzzers)
- Breadboards, jumper wires, power supplies

Return a JSON object with this exact structure:
{
  "components": [
    { "name": "Component Name", "confidence": 0.95, "notes": "optional detail" }
  ]
}

Rules:
- Only list components you can actually see in the image.
- If you are uncertain about a component, set confidence below 0.7 and add a note.
- Do not guess components that are not visible.
- Return valid JSON only, no extra text.`;

  const requestBody = {
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }
    ]
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  let parsed;
  try {
    // Strip possible markdown code fences
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI returned an unparseable response. Please try again.');
  }

  const components = (parsed.components || []).map(c => ({
    name: c.name,
    confidence: typeof c.confidence === 'number' ? c.confidence : null,
    notes: c.notes || null,
    source: 'ai'
  }));

  return {
    mode: 'live',
    disclaimer: 'Component detection is AI-assisted. Always verify detections before building circuits.',
    components
  };
}

module.exports = { analyzeImage };
