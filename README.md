# CircuitVision AI ⚡

> **"Snap it. Understand it. Build something amazing."**

AI-powered Arduino project discovery assistant built for the IBM Bob Hackathon.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure AI key
cp .env.example .env
# Edit .env and add OPENAI_API_KEY for live image analysis

# 3. Start the server
npm start

# 4. Open in browser
# http://localhost:3000
```

## Features

| Feature | Works without API key |
|---|---|
| AI Hardware Scanner (manual + demo) | ✅ |
| Project Recommendations (8 projects) | ✅ |
| Project Details + Wiring + Code | ✅ |
| Copy / Download Arduino sketch | ✅ |
| Download project guide (.txt) | ✅ |
| Troubleshooting Assistant | ✅ |
| Build for Good section | ✅ |
| Workspace / progress checklist | ✅ |
| Live AI image analysis | 🔑 needs OPENAI_API_KEY |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Server status + mode |
| GET | /api/projects | List all projects |
| GET | /api/projects/:id | Full project detail |
| POST | /api/projects/recommend | Match projects to components |
| POST | /api/analyze | Analyse uploaded image |
| POST | /api/troubleshoot | Diagnose hardware/code problem |

## Project Catalogue

1. Smart Parking Assistant
2. Soil Moisture Monitoring System
3. Water Tank Level Alert
4. Temperature and Humidity Monitor
5. Touchless Smart Dustbin
6. Obstacle Detection Alert
7. Smart Plant Care Monitor
8. Water Usage Monitoring Prototype
