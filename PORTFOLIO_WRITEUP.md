# **Multi-Agent Traffic Simulation System**

## **Overview**

The Multi-Agent Traffic Simulation System is a sophisticated traffic management simulation built to model autonomous vehicle behavior in a complex urban environment. Developed as part of my AI coursework at Tecnológico de Monterrey, this project demonstrates the intersection of artificial intelligence, computer graphics, and distributed systems architecture.

The simulation features autonomous vehicles (agents) that navigate through a grid-based city environment filled with roads, traffic lights, obstacles, and destination points. Each vehicle independently calculates optimal routes, makes real-time decisions to avoid collisions, changes lanes when necessary, and obeys traffic signals—all while being visualized in an interactive 3D environment.

**Tech Stack:** Python, Mesa Framework, Flask, WebGL, Three.js (TWGL), JavaScript, BFS Algorithm

**Timeline:** August 2023 - December 2023

---

## **Key Features & Technical Highlights**

### **1. Intelligent Pathfinding with Memoization**

The core of each vehicle's intelligence lies in its pathfinding algorithm. Each car agent uses **Breadth-First Search (BFS)** to calculate the shortest path from its current position to its randomly assigned destination.

**The Innovation:** To optimize performance, I implemented a **memoization system** that caches previously calculated routes. Since multiple vehicles often travel between the same locations, this dramatically reduces redundant computations.

- **Route Caching:** Routes are stored in a global memo dictionary with a key combining start position and destination
- **Performance Gains:** The system tracks memoization hits vs. misses, showing significant computational savings as the simulation runs
- **Dynamic Recalculation:** When vehicles change lanes, new routes are calculated from the new position and cached for future use

**Technical Implementation:**

```python
key = str(start) + str(destination)
if key in self.model.memo:
    return self.model.memo[key]  # Cache hit!
# Otherwise, calculate with BFS and store result
```

### **2. Custom CautionScheduler for Collision Prevention**

One of the most challenging aspects was preventing collisions at intersections. I developed a **custom scheduler** that manages agent activation order based on spatial awareness of "danger zones."

**How it works:**

- **Danger Square Detection:** The scheduler identifies intersection points and lane merge areas as "danger squares"
- **Priority-Based Activation:** Vehicles in danger zones are activated first, along with vehicles ahead of them
- **Pre-Danger Buffers:** Vehicles approaching danger zones are held back to maintain safe following distances
- **Cascading Activation:** When a vehicle in a danger zone moves, all vehicles in front are activated in order to prevent gaps

This ensures smooth traffic flow without collisions, even at complex intersections.

### **3. Advanced Vehicle Behavior**

Each vehicle exhibits realistic autonomous behavior:

- **Traffic Light Compliance:** Cars detect when they're on a traffic light cell and stop when the light is red
- **Dynamic Lane Changing:** When stuck behind another vehicle for more than one step, cars attempt to change lanes
- **Collision Avoidance:** Vehicles check adjacent cells before moving and recalculate routes when obstacles are detected
- **Destination Management:** Upon reaching their destination, vehicles remove themselves from the simulation and report statistics

### **4. Real-Time 3D Visualization with WebGL**

The simulation features a sophisticated 3D visualization system built with WebGL:

- **Custom Phong Shading:** Implemented vertex and fragment shaders for realistic lighting and material properties
- **Smooth Interpolation:** Vehicle movements are interpolated over 200ms for fluid motion between grid cells
- **Interactive Camera:** Orbital camera system with keyboard controls for rotation, panning, and zooming
- **Dynamic Traffic Lights:** Traffic lights emit red/green glow using emission colors in the shader
- **OBJ Model Loading:** Custom parser loads 3D models for cars, buildings, and traffic lights
- **Lane Markings:** Procedurally generated road geometry with white lane dividers

### **5. Flask REST API Architecture**

The backend exposes a clean REST API that separates simulation logic from visualization:

**Key Endpoints:**

- `POST /init` - Initialize simulation with map data
- `GET /getCars` - Retrieve all vehicle positions and directions
- `GET /getTrafficLights` - Get traffic light states and positions
- `GET /getBuildings` - Fetch obstacle positions
- `GET /getRoads` - Retrieve road network data
- `GET /update` - Advance simulation by one step and return updated state

### **6. Graph-Based City Representation**

The city map is represented as a **directed adjacency graph** that's built automatically from a text file:

- **Text Map Parsing:** Roads, traffic lights, obstacles, and destinations are encoded with ASCII characters (`>`, `<`, `^`, `v`, `S`, `s`, `#`, `D`)
- **Graph Generation:** A BFS traversal builds the graph structure, detecting valid moves and lane changes
- **Traffic Light Direction Detection:** Traffic light directions are inferred by checking adjacent road cells
- **Multi-lane Support:** Side checking allows vehicles to detect parallel lanes for lane-changing maneuvers

### **7. Comprehensive Data Collection**

The system tracks extensive simulation metrics:

- Active vehicle count over time
- Total vehicles that successfully reached destinations
- Step count distribution (how many steps vehicles took to reach destinations)
- Memoization efficiency (cache hits vs. misses)
- Real-time visualization of all metrics via charts

---

## **Challenges & Solutions**

### **Challenge 1: Preventing Deadlocks at Intersections**

**Problem:** Initial implementations caused vehicles to collide or deadlock at intersections when multiple cars tried to occupy the same cell simultaneously.

**Solution:** Developed the CautionScheduler that identifies intersection danger zones at initialization and manages agent activation order. Vehicles in critical zones are processed first along with all vehicles ahead of them in their lane, ensuring proper traffic flow without conflicts.

### **Challenge 2: Lane Changing Logic**

**Problem:** When vehicles got stuck behind slower traffic, they would wait indefinitely, creating unrealistic traffic jams.

**Solution:** Implemented intelligent lane-changing behavior that activates after a vehicle has been stopped for more than one step. The system checks diagonal adjacent cells based on current direction, validates if they're empty, and dynamically recalculates the route from the new lane position.

### **Challenge 3: Performance Optimization**

**Problem:** Recalculating routes with BFS for every vehicle at every step was computationally expensive, especially with 50+ active vehicles.

**Solution:** Implemented a memoization system that caches calculated routes. Since many vehicles travel between the same start-destination pairs, this reduced redundant calculations significantly. The system tracks that over 60% of route requests are served from cache.

### **Challenge 4: Smooth 3D Animation**

**Problem:** The discrete grid-based simulation caused jerky vehicle movements in the 3D visualization.

**Solution:** Implemented client-side interpolation where vehicle positions are smoothly animated over 200ms between grid cells. The JavaScript frontend maintains both current and target positions, calculating intermediate positions based on elapsed time for fluid motion.

### **Challenge 5: Synchronizing Backend and Frontend State**

**Problem:** The Python simulation ran at its own pace while the WebGL frontend needed to maintain responsive frame rates.

**Solution:** Decoupled the simulation from visualization using a REST API architecture. The frontend polls for updates every 10 frames (~300ms at 60fps), maintaining smooth animations while the backend processes simulation logic independently.

### **Challenge 6: Graph Construction from Text Maps**

**Problem:** Converting a 2D text file into a directed graph that accounts for one-way streets, intersections, and valid turning movements.

**Solution:** Implemented a two-pass system: first creating the graph structure with BFS from any road cell, then enhancing it by checking adjacent cells for valid lane changes based on direction compatibility. Traffic light directions are inferred by examining surrounding road cells.

---

## **Results & Impact**

The simulation successfully demonstrates:

- **Autonomous Agent Coordination:** Multiple vehicles navigate independently while avoiding collisions
- **Realistic Traffic Patterns:** Traffic lights create natural stopping patterns, and lane changing reduces congestion
- **Performance Efficiency:** Memoization reduces computational overhead by caching frequently-used routes
- **Scalable Architecture:** The REST API design allows the simulation to run independently from the visualization
- **Educational Value:** Provides clear visualization of multi-agent AI concepts and graph algorithms in action

---

## **Technologies Used**

**Backend:**

- **Python 3.10** - Core programming language
- **Mesa Framework** - Agent-based modeling framework
- **Flask** - REST API server
- **Flask-CORS** - Cross-origin resource sharing

**Frontend:**

- **JavaScript (ES6+)** - Client-side logic
- **WebGL 2.0** - Graphics rendering
- **TWGL.js** - WebGL utility library
- **Vite** - Build tool and dev server
- **lil-gui** - UI controls for lighting/camera settings

**Algorithms & Concepts:**

- Breadth-First Search (BFS) pathfinding
- Memoization for dynamic programming optimization
- Graph theory (directed adjacency lists)
- Multi-agent systems
- Priority-based scheduling
- 3D graphics and shader programming (Phong lighting model)

---

## **Future Enhancements**

Given more time, potential improvements could include:

- **A\* Pathfinding:** Replace BFS with A\* for more intelligent route selection considering traffic density
- **Traffic Density Heatmaps:** Visualize congestion levels across the city
- **Multiple Vehicle Types:** Add buses, emergency vehicles with different behaviors and priorities
- **Dynamic Traffic Lights:** Implement adaptive traffic light timing based on traffic flow
- **Pedestrian Agents:** Add pedestrians with crosswalk interactions
- **Machine Learning:** Train agents to optimize routes based on historical traffic patterns

---

## **How to Run**

### **Prerequisites:**

- Python 3.7+
- Node.js and npm

### **Installation:**

1. **Install Python dependencies:**

```bash
pip install mesa flask flask-cors requests
```

2. **Install frontend dependencies:**

```bash
cd frontend
npm install
```

### **Running the Project:**

**Option 1: 3D WebGL Visualization (Recommended)**

1. Start the Flask API server:

```bash
python agents_server.py
```

2. In a separate terminal, start the frontend:

```bash
cd frontend
npx vite
```

3. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

**Option 2: Mesa 2D Visualization**

```bash
python server.py
```

Then open `http://localhost:8521` in your browser.

---

This project represents a comprehensive integration of AI algorithms, computer graphics, and software architecture principles, demonstrating practical applications of multi-agent systems in traffic management scenarios.

---

**Project completed as part of TC2008B - Multi-Agent Systems and Computer Graphics course at Tecnológico de Monterrey**
