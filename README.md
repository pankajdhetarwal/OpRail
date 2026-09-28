# OpRail: AI-Powered Automatic Block Planning

**SIH 2026, Problem Statement 26027**

[Watch the Prototype Demonstration Video](https://youtu.be/Y8KzXUSgnt4)

## Overview

OpRail is an intelligent railway block planning system designed to streamline and automate the scheduling of maintenance blocks across the railway network. By integrating data from various maintenance sources (Track, Signal, Traction) and utilizing advanced Artificial Intelligence and Operations Research techniques, OpRail generates conflict-free, highly optimized maintenance schedules.

The goal is to ensure maximum safety and maintenance throughput while minimizing disruptions to scheduled train operations.

## Key Features

### 1. Data Integration
OpRail aggregates maintenance requests from multiple existing railway systems:
*   **TMS (Track Management System):** For track and civil engineering maintenance.
*   **SMMS (Signal Maintenance Management System):** For signaling and telecommunication tasks.
*   **TDMS (Traction Distribution Management System):** For overhead equipment and power supply maintenance.
*   **COA (Control Office Application):** For real-time train movement and operational data.

### 2. Intelligent Prioritization
Not all maintenance tasks are equal. The system features a Priority Engine that evaluates each maintenance request based on urgency, asset health, and operational impact. Critical tasks that pose safety risks are automatically escalated.

### 3. AI-Driven Optimization (OR-Tools)
At the core of OpRail is a powerful constraint programming solver built on Google OR-Tools. The optimizer:
*   Schedules maintenance tasks (blocks) efficiently.
*   Prevents overlaps and conflicts between different maintenance activities.
*   Ensures that scheduled blocks do not interfere with the regular train timetable.
*   Suggests "Bundle Candidates," grouping geographically and temporally close maintenance tasks to maximize resource utilization and minimize track downtime.

### 4. Interactive Visualization
The frontend provides comprehensive tools for operational planners:
*   **Operations Dashboard:** A high-level overview of network health and pending maintenance tasks.
*   **Time-Space Diagram:** A visual representation of trains and maintenance blocks across time and distance, making it easy to spot conflicts.
*   **Block History & Validator:** Tools to review past decisions and validate AI-generated schedules before final approval.

### 5. Explainable AI
To build trust with operational planners, OpRail includes an explanation layer powered by Large Language Models. When a schedule is generated, the system provides clear, human-readable explanations of why certain tasks were prioritized and how conflicts were resolved.

## System Architecture

OpRail is built with a modern, modular architecture:

*   **Frontend:** A responsive, interactive user interface built with React and TypeScript.
*   **Backend:** A high-performance REST API built with FastAPI (Python).
*   **Database:** Configured with SQLAlchemy to handle complex relational data.
*   **Solver Engine:** Python-based OR-Tools integration for constraint optimization.

### Directory Structure

```text
app/
├── main.py          # FastAPI application entry point
├── core/            # Configuration and database connection setup
├── models/          # SQLAlchemy ORM definitions (Database Schema)
├── schemas/         # Pydantic models (API Data Validation)
├── api/routes/      # API endpoints for frontend communication
└── services/        # Core logic: Priority Engine, Optimizer, and AI Explainers
```

## Getting Started

### Prerequisites
*   Python 3.9+
*   Node.js (for the frontend)

### Backend Setup

1.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ```
2.  Install the required dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Set up the environment variables:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` to include your database credentials and API keys.
4.  Run the application:
    ```bash
    uvicorn app.main:app --reload
    ```
5.  Access the API documentation at `http://127.0.0.1:8000/docs`.

### Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Data Strategy

OpRail is designed to work with real published train timetable data. For maintenance defect logs (which are typically classified), the system utilizes credible synthetic data generators to simulate realistic inputs from TMS, SMMS, and TDMS. This ensures the system can be thoroughly tested and demonstrated safely.

## Future Roadmap
*   Integration with live railway telemetry data.
*   Advanced machine learning models for predictive maintenance.
*   Real-time dynamic rescheduling in response to unforeseen events.

---
*Developed for the Smart India Hackathon 2026*
