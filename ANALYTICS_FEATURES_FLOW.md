# GeoFarm-IS Analytics & Features Flow Diagram Prompt

Generate a detailed data flow diagram showing the analytics and key features workflow in the GeoFarm Information System.

---

## SYSTEM OVERVIEW
**System Name:** GeoFarm-IS (Geographic Farming Information System)  
**Purpose:** Municipal agriculture information system for Tumauini, Isabela with farm analysis and risk assessment  
**Note:** Forecast & Advisory module has been removed from the system

---

## MAIN ANALYTICS MODULES

### 1. FARM ANALYSIS MODULE
**Purpose:** Per-farmer risk analysis and intervention recommendations

**Data Sources:**
- Farmer Records (farmers table)
- Farm Parcels (farm_parcels table)
- Crop Seasons (crop_seasons table)
- Climate Risk Assessments (climate_risk_assessments table)
- Livestock Data (livestock table)
- Fishponds (fishponds table)

**Process Flow:**
1. **Farmer Selection**
   - Input: Farmer name/RSBSA search
   - Filter by: Barangay, Assessment Status (assessed/unassessed/stale)
   - Status determination:
     * Assessed: Has climate risk assessment
     * Unassessed: No risk assessment exists
     * Stale: Latest assessment older than 6 months

2. **Risk Analysis (ParcelRiskAnalyser Service)**
   - Analyze each parcel individually
   - Calculate risk scores based on:
     * Historical crop performance (yields, losses)
     * Farm type (irrigated/rainfed/upland)
     * Previous season outcomes (profitable/break-even/loss)
     * Climate vulnerability indicators
   - Generate risk level: High / Moderate / Low
   - Identify affected parcels

3. **Recommendation Engine (ClimateRecommendationEngine)**
   - Generate risk factors with weights
   - Produce prioritized action recommendations
   - Top 3 actions highlighted
   - Full recommendation list available

4. **Intervention Suggestions (InterventionSuggester)**
   - Suggest interventions based on risk factors:
     * Field Visit
     * Training Session
     * Financial Assistance
     * Technical Assistance
     * Monitoring Visit
   - Check for existing open interventions (avoid duplicates)
   - Suggest available assistance programs

5. **Output Actions:**
   - **View Analysis:** Display risk level, scores, affected parcels, recommendations
   - **Send Alert:** Email farmer with risk alert and top recommendations
   - **Open Intervention:** Create intervention record (field visit, training, etc.)
   - **Record Assistance:** Link to assistance distribution

**Key Outputs:**
- Risk Level (High/Moderate/Low)
- Risk Score (0-100)
- Affected Parcel Details
- Top 3 Priority Actions
- Complete Recommendation List
- Suggested Interventions
- Historical Season Data

---

### 2. SEASONAL TRACKING MODULE
**Purpose:** Record and monitor crop season performance

**Data Flow:**
1. **Data Entry**
   - Input: Parcel, Season (wet/dry), Year, Crop
   - Capture:
     * Area planted (hectares)
     * Planting & harvest dates
     * Yield quantity & unit (kg/sacks/etc)
     * Production costs (itemized inputs)
     * Selling price
     * Total income
   - Unique constraint: One record per parcel-season-year

2. **Input Itemization (seasonal_inputs table)**
   - Types: fertilizer, herbicide, pesticide, insecticide, fungicide, seed, fuel, other
   - Record: Name, quantity, unit, cost
   - Linked to: crop_season_id

3. **Automatic Calculations**
   - Production Cost = Sum of all inputs + labor + other expenses
   - Gross Revenue = Yield × Selling Price
   - Net Income = Gross Revenue - Production Cost
   - Cost per kg = Production Cost / Yield
   - Cost per hectare = Production Cost / Area Planted
   - Financial Outcome: Loss / Break-even / Profitable

4. **Grouping Logic (for wet/dry combined view)**
   - Group by: parcel_id + cropping_year + crop_id
   - Display wet and dry seasons together
   - Annual totals:
     * Total Cost = Wet Cost + Dry Cost
     * Total Revenue = Wet Revenue + Dry Revenue
     * Total Yield (only if same unit)

5. **Outputs:**
   - Per-season detailed view
   - Annual aggregates
   - Cost analysis by year
   - Profitability trends
   - Input usage patterns

---

### 3. GIS MAPPING MODULE
**Purpose:** Visualize farm parcels on interactive map

**Data Flow:**
1. **Parcel Boundaries (farm_parcels.geojson_data)**
   - Storage: GeoJSON format (Polygon/MultiPolygon)
   - Source options:
     * Hand-drawn on map
     * Imported from survey file (KML, GeoJSON, Shapefile)
   - Validation: Must be within Tumauini municipal bounds

2. **Map Rendering (MapLibre GL)**
   - Basemap: ESG World Imagery (satellite)
   - Layers:
     * Municipal boundary (dashed green line)
     * Parcel fills (colored by parcel ID, 40-65% opacity)
     * Parcel casings (black outlines, 4.5-11px width)
     * Parcel lines (white/colored borders, 3-7.5px)
     * Parcel pins (below zoom 15, colored markers with arrows)
     * Selected parcel (yellow highlight, 5px dashed line)
     * Draft polygons (blue while drawing)

3. **Interactivity:**
   - Click parcel: Show farmer, crop, area, seasons, assistance
   - Draw tool: Click vertices, double-click to close
   - Import tool: Upload surveyed boundary file
   - Locate button: Zoom to all mapped parcels
   - Toggle layers: Show/hide municipal boundary, parcels

4. **Data Integration:**
   - Fetch: `/admin/gis/parcels-geojson` endpoint
   - Returns: FeatureCollection with properties:
     * Farmer name, RSBSA number
     * Parcel number, barangay
     * Area (ha), commodity, farm type
     * Boundary source (drawn/imported)

---

### 4. ASSISTANCE DISTRIBUTION TRACKING
**Purpose:** Record and monitor government assistance to farmers

**Data Flow:**
1. **Program Setup**
   - Define assistance programs (financial_assistance table)
   - Set program details: name, type, budget, duration

2. **Distribution Recording (assistance_distributions table)**
   - Link: farmer_id + program_id
   - Capture:
     * Quantity given
     * Distribution date
     * Status (pending/distributed/completed)
     * Cost/value
   - Notifications: Farmers notified of approved assistance

3. **Integration with Analytics:**
   - Farm Analysis module suggests available programs
   - Distribution history shown in farmer profile
   - Budget tracking and reporting

---

### 5. INTERVENTION MANAGEMENT
**Purpose:** Track agricultural interventions and follow-ups

**Data Flow:**
1. **Intervention Creation (agricultural_interventions table)**
   - Triggered by: Farm Analysis recommendations
   - Types:
     * Field Visit
     * Training Session
     * Monitoring Visit
     * Technical Assistance
   - Capture:
     * Risk factor key (links to assessment)
     * Priority (high/medium/low)
     * Target date
     * Assigned staff
     * Status (pending/in_progress/completed/cancelled)

2. **Action Tracking (intervention_actions table)**
   - Record each action taken
   - Capture: Date, action type, notes, outcome
   - Update intervention status

3. **Follow-ups (follow_ups table)**
   - Schedule follow-up visits
   - Track completion
   - Link to original intervention

---

## DATA FLOW DIAGRAM STRUCTURE

### External Entities:
1. **Staff** (Super Admin, Admin, Staff roles)
2. **Farmers** (Farmer role)

### Main Processes:
1. **P1: Data Collection**
   - Farmer registration (RSBSA form)
   - Parcel registration
   - Season recording
   - Climate assessment

2. **P2: Risk Analysis**
   - ParcelRiskAnalyser service
   - Score calculation
   - Risk level determination
   - Factor identification

3. **P3: Recommendation Generation**
   - ClimateRecommendationEngine
   - Action prioritization
   - Intervention suggestions

4. **P4: Intervention Management**
   - Create interventions
   - Track actions
   - Schedule follow-ups
   - Mark completions

5. **P5: Reporting**
   - Generate reports
   - Export data
   - Analytics dashboards

### Data Stores:
- D1: Farmers
- D2: Farm Parcels
- D3: Crop Seasons
- D4: Climate Risk Assessments
- D5: Interventions
- D6: Assistance Distributions
- D7: Livestock
- D8: Fishponds
- D9: Seasonal Inputs
- D10: Audit Logs

---

## DIAGRAM NOTATION

Use standard DFD Level 1 notation:
- **Circles/Rounded Rectangles:** Processes (P1, P2, etc.)
- **Squares:** External Entities
- **Open Rectangles:** Data Stores (D1, D2, etc.)
- **Arrows:** Data flows (labeled with data name)

**Data Flow Labels Examples:**
- "Farmer details"
- "Risk assessment data"
- "Analysis results"
- "Recommendations"
- "Season records"
- "Intervention tracking"

---

## KEY INSIGHTS TO HIGHLIGHT

1. **Circular Flow:** Assessment → Analysis → Recommendations → Interventions → Follow-up → Re-assessment

2. **Data Reuse:** Historical season data feeds risk analysis

3. **Multi-source Evidence:** Risk scores combine:
   - Historical performance (actual yields/losses)
   - Farmer questionnaire (perceived risks)
   - Environmental factors (farm type, location)

4. **Intervention Lifecycle:** Suggested → Created → In Progress → Completed → Validated

---

## COLOR CODING SUGGESTIONS

- **Risk Analysis processes:** Orange/Red tones
- **Data Collection processes:** Green tones
- **Intervention processes:** Purple tones
- **Reporting processes:** Blue tones
- **High-priority data flows:** Thick red arrows
- **Automated calculations:** Dashed arrows
- **External entities:** Gray boxes

---

## GENERATE:
Create a comprehensive Level 1 Data Flow Diagram showing:
1. All 5 main processes listed above
2. All 10 data stores
3. Staff and Farmer external entities
4. Major data flows between processes and data stores
5. Labels on all data flows
6. Process numbering (P1-P5)
7. Data store numbering (D1-D10)

Make it clear, professional, and suitable for technical documentation. Use colors to distinguish different types of processes. Ensure all arrows are clearly labeled with the data being transferred.
