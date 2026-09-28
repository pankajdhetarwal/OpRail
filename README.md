<div align="center">
  <h1>OpRail: AI-Powered Automatic Block Planning</h1>
  <p><strong>Smart India Hackathon 2026 | Problem Statement 26027</strong></p>

  <a href="https://youtu.be/Y8KzXUSgnt4" target="_blank">
    <img src="https://img.youtube.com/vi/Y8KzXUSgnt4/maxresdefault.jpg" alt="Watch the Prototype Demonstration Video" width="600" />
  </a>
  <br />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/OR_Tools-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="OR-Tools" />
</div>
<br />

## The Problem Statement

**Problem Statement 26027:** Scheduling railway maintenance blocks manually is an incredibly complex puzzle. Indian Railways operates one of the densest train networks in the world. When a section of track needs maintenance—whether it's the track itself, signaling, or overhead power lines—trains cannot run on that section. Finding the right window of time (a "block") to perform this maintenance without severely delaying regular passenger and freight trains is a massive logistical challenge. 

Our goal is to automate this process. We need a system that can take maintenance requests from various departments, understand the urgency of each request, and use Artificial Intelligence to find the absolute best time to schedule them.

## Introducing OpRail

OpRail is an intelligent railway block planning system built to solve this exact problem. It acts as a central hub, integrating data from different railway maintenance departments, prioritizing tasks based on safety and urgency, and utilizing an advanced constraint programming solver to generate conflict-free schedules. 

The system ensures maximum maintenance throughput while keeping the trains running on time.

## Core Features

### 1. Unified Data Integration
In the real world, maintenance data is siloed. OpRail brings it all together into a single, cohesive platform:
- **TMS (Track Management System):** For civil engineering and track defects.
- **SMMS (Signal Maintenance Management System):** For signaling and telecommunication issues.
- **TDMS (Traction Distribution Management System):** For overhead electrical equipment.
- **COA (Control Office Application):** For live train schedules and movement data.

### 2. Intelligent Priority Engine
Not all maintenance is equally important. A cracked rail is a higher priority than routine cleaning. OpRail features a built-in Priority Engine that scores every incoming task. It looks at the severity of the defect, the age of the request, and the operational impact, ensuring that critical safety issues are scheduled first.

### 3. AI-Driven Optimization (OR-Tools)
This is the brain of the project. We use Google OR-Tools, a powerful constraint optimization engine, to solve the scheduling puzzle. The optimizer ensures:
- Maintenance blocks do not overlap improperly.
- Blocks are strictly scheduled around existing train timetables (no collisions).
- Maximum possible work is completed in the available time windows.

### 4. Smart Bundling
If a track is closed to fix a signal, it makes sense to also inspect the overhead wires in that same area. OpRail automatically identifies "Bundle Candidates." It groups geographically and temporally close maintenance tasks so that multiple departments can work simultaneously during a single block, drastically reducing overall track downtime.

### 5. Explainable AI (Gemini Integration)
AI can sometimes feel like a black box. To build trust with the railway planners who use the system, we integrated an explanation layer powered by Large Language Models. When the optimizer creates a schedule, the AI generates a clear, human-readable explanation of why it made those specific decisions and how it resolved potential conflicts.

### 6. Interactive Visualization Dashboard
OpRail provides a robust frontend interface for operational planners:
- **Operations Dashboard:** A high-level, real-time overview of network health, pending requests, and upcoming blocks.
- **Time-Space Diagram:** A visual, intuitive chart showing trains and maintenance blocks across time and distance. This makes it instantly obvious if a schedule is viable.
- **Block History & Validator:** Tools to review past decisions and manually validate AI-generated schedules before they are finalized.

## Architecture and Project Structure

OpRail is built using a modern, layered architecture. This separates concerns, meaning changes to the database won't unexpectedly break the API or frontend.

- **Frontend:** A fast, responsive user interface built with React, TypeScript, and Vite.
- **Backend:** A high-performance REST API built with FastAPI (Python).
- **Database:** SQLAlchemy ORM used for robust, relational data management (currently utilizing SQLite/PostgreSQL).
- **Solver Engine:** Python-based OR-Tools integration.

```text
app/
├── main.py          # The FastAPI application entry point
├── core/            # Configuration and database connection setup
├── models/          # SQLAlchemy ORM definitions (Database Tables)
├── schemas/         # Pydantic models (API Data Validation)
├── api/routes/      # API endpoints for frontend communication
└── services/        # Core business logic: Priority Engine, Optimizer, and LLM Explainers
```

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js (for the frontend)

### Backend Setup

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up the environment:
   ```bash
   cp .env.example .env
   ```
   *Edit the `.env` file to include your database URL and API keys.*

4. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *You can now access the interactive API documentation at `http://127.0.0.1:8000/docs`.*

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Data Strategy Note

The timetable scheduling leverages published Indian Railways data. However, actual maintenance defect logs (from TMS, SMMS, TDMS) are strictly internal and not available to the public. To make this project functional and demonstratable, we utilize synthetic data generators that create highly realistic, credible maintenance requests matching the expected formats of these systems.

---
*Built for the Smart India Hackathon 2026*
