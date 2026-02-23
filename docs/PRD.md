# Product Requirements Document (PRD): Estonia Electricity Price Dashboard

## 1. Project Overview
The **Estonia Electricity Price Dashboard** is a premium, highly interactive web application designed to display real-time, historical, and forecasted electricity prices for the Estonia (EE) region. It fetches data directly from the official Elering API and presents it in a sleek, modern, dark-themed user interface.

## 2. Target Audience
- **Consumers & Homeowners:** Individuals looking to optimize their electricity usage based on spot prices (e.g., deciding when to run appliances or charge EVs).
- **Enthusiasts & Analysts:** Users interested in monitoring energy market trends and analyzing statistical price distributions.

## 3. Core Features

### 3.1. Current Price Widget
- **Live Price Display:** Shows the exact electricity price for the current hour in cents/kWh.
- **Trend Indicators:** Displays the price difference (in cents/kWh) compared to both the preceding clock hour and the next clock hour, with visual indicators (green for down, red for up). On narrow screens, these are displayed horizontally next to the current price to minimize vertical space and maximize chart visibility.
- **Median Context:** Displays the median price for the currently selected timeframe directly beneath the current price for quick reference.

### 3.2. Interactive Price Chart
- **Timeline Visualization:** An area chart displaying prices for the selected date range. For wider timeframes, data points are mathematically aggregated (e.g., into 6-hour, 12-hour, or 24-hour buckets) to maintain high rendering performance and responsiveness.
- **Visual Distinction:** Distinct color coding and styling. The past/current price area uses an ethereal teal-to-emerald gradient, while future prices use an indigo-to-violet gradient. The chart lines cast a custom neon `<filter>` drop shadow onto the background grid for added physical depth.
- **Interactivity (Focus Mode):** Support for advanced cinematic hover and touch states. When the user interacts with the chart, the background grid, axes, and statistical lines smoothly dim to 30% opacity to pull visual focus entirely to the active data curve.
- **Custom Tooltip & Cursor:** A custom soft-glowing vertical band fluidly tracks the user's cursor or finger, triggering a glassmorphism (backdrop-blur) tooltip showing exact time and price. The `activeDot` pulses with a corresponding neon glow.
- **Dynamic X-Axis:** The time axis dynamically formats based on the selected time span (e.g., `HH:mm` for daily views, `MMM d` for weekly/monthly views, `MMM yyyy` for yearly views).
- **Responsiveness:** Auto-scaling taking full width of the container while maintaining aspect ratio, lifting slightly on hover (`-translate-y`) alongside the main interface cards.

### 3.3. Advanced Controls & Settings
- **Collapsible Mobile View:** On narrow screens, the controls are hidden behind a toggle button by default to maximize chart visibility.
- **Timeframe Scale:** A sleek dropdown selector to quickly switch the displayed data timeframe between Yesterday, Today, Tomorrow, This Week, This Month, This Quarter, and This Year.
- **Discovery (Cheapest Period):** Users can toggle a highlighting feature to automatically calculate and discover the mathematically cheapest contiguous period of electricity (1 to 8 hours) within their currently selected timeframe overlaying a reference area on the chart.
- **Custom Date Range:** Date pickers to fetch and visualize historical or forecasted electricity prices for any custom start and end date combination. Elering API constraints are bypassed by automatically chunking large requests.
- **VAT Toggle:** A button allowing users to instantly recalculate all displayed prices to either include or exclude the Estonian Value Added Tax (VAT), which is currently 22%. By default, VAT should be included.
- **Advanced Chart Settings (Statistical Overlays):** Toggles to overlay horizontal reference lines on the main chart for mathematical calculations. The reference lines explicitly state their calculated value (e.g., `Mean 9.19 ¢/kWh`):
  - Mean (Average)
  - Median (50th Percentile)
  - 75th Percentile
  - 90th Percentile
  - 95th Percentile
- **Future Price Prediction:** Uses a statistical model blending the identical hour from yesterday and 7 days ago to predict upcoming prices if the official API payload is incomplete for future hours.

### 3.4. Auto-Refresh Mechanism
- The dashboard must automatically poll the API or refresh its data state on a reasonable interval (e.g., every 15 minutes) to ensure the "Current Price" widget accurately rolls over at the top of the hour without requiring a manual page reload.

## 4. Technical Specifications

### 4.1. Architecture & Stack
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom dark theme, glassmorphism UI)
- **Charting Library:** Recharts
- **Icons:** Lucide-react
- **Form Controls:** Headless UI (for accessible toggle switches)

### 4.2. External APIs
- **Provider:** Elering AS Dashboard API
- **Endpoints:**
  - `GET https://dashboard.elering.ee/api/nps/price/EE/current`
  - `GET https://dashboard.elering.ee/api/nps/price?start={iso_start}&end={iso_end}`
- **Data Transformation:** The API returns payloads in `€/MWh` and Unix timestamps. The application must convert these to `¢/kWh` (divide by 10) and properly localize timestamps to the user's browser timezone.
- **CORS Proxy:** Client-side fetches route through a CORS proxy (`https://api.codetabs.com/v1/proxy/?quest=`) to circumvent browser restrictions when querying the Elering API directly.
- **Chunking Mechanism:** To bypass the Elering API's payload size limits, requests spanning long historical periods are automatically chunked into 90-day intervals.

## 5. Non-Functional Requirements
- **Performance:** Fast initial load utilizing Next.js Server-Side Rendering (SSR) capabilities where applicable, though most data fetching will be Client-Side due to dynamic time dependencies. Data aggregation is strictly enforced on large timeframes to prevent browser thread locking.
- **Design & Aesthetics:** The UI must be highly "premium" and modern, drastically moving beyond simple default aesthetics. It utilizes:
  - **Dynamic Ambient Background:** A slow-moving mesh gradient that pulses to make the app feel alive.
  - **Contextual Glows:** The `CurrentPriceCard` projects a soft outer shadow/glow that shifts color (e.g., green to red) based on whether the current electricity price is mathematically cheap or expensive relative to the median.
  - **Deep Glassmorphism:** Heavy backdrop blurs combined with translucent container borders and subtle hover-lift physics (`translate-y`) on all UI cards.
  - **Pill Data Badges:** Reusable custom SVG pill-shaped background labels used behind statistical chart text to guarantee legibility regardless of complex background chart paths.
- **Responsiveness:** The layout must gracefully degrade from a multi-column desktop layout to a stacked, single-column layout on mobile devices. Text wrapping and header padding should dynamically adjust to prevent awkwardly broken sentences on wide screens or cramped text on mobiles.
- **Error Handling:** Graceful error states if the Elering API is unreachable or returns malformed payloads.

## 6. Future Considerations
- Multi-region support (e.g., adding Finland, Latvia, Lithuania).
- Push notifications or alerts for price thresholds.
- User accounts / saved preferences.
