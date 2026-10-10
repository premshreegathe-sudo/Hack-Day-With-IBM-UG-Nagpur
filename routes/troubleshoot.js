'use strict';

const express = require('express');
const router = express.Router();

// ── Rule-based troubleshooting knowledge base ─────────────────────────────────
const RULES = [
  {
    keywords: ['not compiling', 'compile error', 'compilation failed', 'syntax error', 'expected'],
    causes: [
      'Missing semicolon or closing brace in the sketch.',
      'Library not installed — check Sketch > Include Library > Manage Libraries.',
      'Wrong board selected in Tools > Board menu.'
    ],
    steps: [
      'Read the error message in the Arduino IDE console carefully — it shows the exact line number.',
      'Check that all #include libraries are installed via the Library Manager.',
      'Ensure Tools > Board matches your actual board (e.g. "Arduino UNO").',
      'Look for missing semicolons (;) or unmatched braces { }.',
      'Try File > New, paste the code again, and re-compile.'
    ]
  },
  {
    keywords: ['upload failed', 'not uploading', 'avrdude', 'programmer not responding', 'port'],
    causes: [
      'Wrong COM port selected in Tools > Port.',
      'Arduino driver not installed on this computer.',
      'Another program (Serial Monitor) is holding the port open.',
      'Faulty or loose USB cable.'
    ],
    steps: [
      'Go to Tools > Port and select the correct COM port for your Arduino.',
      'Close the Serial Monitor before uploading.',
      'Try a different USB cable — some cables are charge-only and carry no data.',
      'On Windows, open Device Manager and check for Arduino under "Ports (COM & LPT)".',
      'Press and hold the Reset button on the Arduino, start the upload, then release it when "Uploading…" appears.'
    ]
  },
  {
    keywords: ['led not working', 'led not lighting', 'led off', 'light not on'],
    causes: [
      'LED connected backwards (anode to GND instead of 5V/pin).',
      'Missing current-limiting resistor — LED may have burned out.',
      'Wrong pin number in the sketch.',
      'pinMode not set to OUTPUT.'
    ],
    steps: [
      'Confirm the long leg (anode) of the LED connects to the positive signal pin.',
      'Ensure a 220Ω–330Ω resistor is in series with the LED.',
      'Match the pin number in the sketch with the physical Arduino pin.',
      'Add pinMode(pin, OUTPUT) in setup() if missing.',
      'Test the LED with a direct 3V coin battery to confirm it is functional.'
    ]
  },
  {
    keywords: ['sensor not reading', 'wrong value', 'reading 0', 'reading -1', 'nan', 'no data'],
    causes: [
      'Incorrect wiring — VCC, GND, or data pin swapped.',
      'Required library not installed or wrong version.',
      'Sensor initialisation missing from setup().',
      'Insufficient power — sensor needs 5V but pin only provides 3.3V.'
    ],
    steps: [
      'Double-check the sensor datasheet wiring: VCC → 5V, GND → GND, DATA → digital/analog pin.',
      'Open Serial Monitor (9600 baud) and print raw sensor values to diagnose.',
      'Ensure the library is installed and the correct object/method is called.',
      'Confirm sensor.begin() or equivalent is called in setup().',
      'Try powering the sensor from the Arduino 5V pin directly, not through a breadboard rail that may have a bad connection.'
    ]
  },
  {
    keywords: ['motor not spinning', 'motor not moving', 'servo not working', 'dc motor'],
    causes: [
      'Motor driver IC (L298N/L293D) not connected correctly.',
      'Insufficient current — motors need more current than the Arduino pin can supply.',
      'PWM pin not used for speed control.',
      'Motor power supply not connected or insufficient voltage.'
    ],
    steps: [
      'Use a dedicated motor driver — never connect a motor directly to an Arduino pin.',
      'Provide a separate 9V–12V power supply to the motor driver VIN.',
      'Ensure the motor driver GND is common with Arduino GND.',
      'Check the IN1/IN2 logic pins match the direction commands in the sketch.',
      'Use analogWrite() on a PWM-capable pin (~) for speed control.'
    ]
  },
  {
    keywords: ['buzzer not beeping', 'no sound', 'buzzer silent'],
    causes: [
      'Active vs passive buzzer confusion — active buzzers need only HIGH/LOW; passive buzzers need tone().',
      'Buzzer polarity reversed.',
      'Pin not set to OUTPUT.',
      'Very short delay — sound too brief to hear.'
    ],
    steps: [
      'For active buzzers: digitalWrite(pin, HIGH) should produce sound immediately.',
      'For passive buzzers: use tone(pin, frequency, duration) instead of digitalWrite.',
      'Check polarity — the "+" leg to the signal pin.',
      'Add delay(1000) after turning on the buzzer to confirm it is working.',
      'Test on a known working pin (e.g. pin 13 with the built-in LED).'
    ]
  },
  {
    keywords: ['wifi not connecting', 'no wifi', 'esp8266', 'esp32', 'network'],
    causes: [
      'Wrong SSID or password in the sketch.',
      'Using a 5 GHz network — ESP8266/ESP32 support 2.4 GHz only.',
      'Insufficient power to the ESP module.',
      'Wrong board package installed in Arduino IDE.'
    ],
    steps: [
      'Double-check the SSID and password strings — they are case-sensitive.',
      'Ensure your router is broadcasting on 2.4 GHz.',
      'Power the ESP module from a stable 3.3V source with at least 500mA capacity.',
      'Install the ESP8266/ESP32 board package via Board Manager.',
      'Open Serial Monitor and check for connection status messages.'
    ]
  }
];

const DEFAULT_RESPONSE = {
  causes: [
    'Incorrect wiring or loose breadboard connection.',
    'Wrong pin assignment in the sketch.',
    'Missing or incompatible library.'
  ],
  steps: [
    'Re-read the wiring table and verify each connection one at a time.',
    'Open the Arduino Serial Monitor at 9600 baud and add Serial.println() statements to trace execution.',
    'Check the Arduino IDE console for any error messages.',
    'Search the exact error message on Arduino forums or the project README.'
  ]
};

function matchRules(problem) {
  const lower = problem.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule;
    }
  }
  return null;
}

// ── POST /api/troubleshoot ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { problem, projectId } = req.body;

    if (!problem || typeof problem !== 'string' || problem.trim().length === 0) {
      return res.status(400).json({
        error: 'Provide a "problem" string describing the issue.'
      });
    }

    if (problem.trim().length > 2000) {
      return res.status(400).json({
        error: 'Problem description too long. Maximum 2000 characters.'
      });
    }

    const matched = matchRules(problem.trim());
    const response = matched || DEFAULT_RESPONSE;

    res.json({
      mode: 'rule-based',
      disclaimer: 'This guidance is generated by a rule-based system. Verify all wiring changes before powering your circuit.',
      projectId: projectId || null,
      causes: response.causes,
      steps: response.steps
    });
  } catch (err) {
    console.error('[troubleshoot] error:', err.message);
    res.status(500).json({ error: 'Troubleshooting engine failed.' });
  }
});

module.exports = router;
