# Product Requirements Document (PRD): Estonia Electricity Price Dashboard

## 1. Project Overview
The **Estonia Electricity Price Dashboard** is a premium, highly interactive web application designed to display real-time, historical, and forecasted electricity prices for the Estonia (EE) region. It fetches data directly from the official Elering API and presents it in a sleek, modern, dark-themed user interface.

## 2. Target Audience
- **Consumers & Homeowners:** Individuals looking to optimize their electricity usage based on spot prices (e.g., deciding when to run appliances or charge EVs).
- **Enthusiasts & Analysts:** Users interested in monitoring energy market trends and analyzing statistical price distributions.

## 3. Core Features

### 3.1. Current Price Widget
- **Live Price Display:** Shows the exact electricity price for the current hour in cents/kWh.
- **Trend Indicators:** Displays the price difference (in cents/kWh) compared to both the preceding clock hour and the next clock hour, with visual indicators (green for down, red for up).
- **Median Context:** Displays the median price for the currently selected timeframe directly beneath the current price for quick reference.

### 3.2. Interactive Price Chart
- **Timeline Visualization:** An area chart displaying prices for the selected date range.
- **Visual Distinction:** Distinct color coding and styling. The past/current price area uses a dynamic 3-color gradient (Green when below median, Blue near median, Red when spiking above). The future price is styled distinctly (purple dashed line/fill).
- **Interactivity:** Support for hover state tooltips showing exact time and price.
- **Dynamic X-Axis:** The time axis dynamically formats based on the selected time span (e.g., `HH:mm` for daily views, `MMM d` for weekly/monthly views, `MMM yyyy` for yearly views).
- **Responsiveness:** Auto-scaling taking full width of the container while maintaining aspect ratio.

### 3.3. Advanced Controls & Settings
- **Collapsible Mobile View:** On narrow screens, the controls are hidden behind a toggle button by default to maximize chart visibility.
- **Timeframe Scale:** Toggles to quickly switch the displayed data timeframe between Yesterday, Today, Tomorrow, This Week, This Month, and This Year.
- **Custom Date Range:** Date pickers to fetch and visualize historical or forecasted electricity prices for any custom start and end date combination.
- **VAT Toggle:** A button allowing users to instantly recalculate all displayed prices to either include or exclude the Estonian Value Added Tax (VAT), which is currently 22%. By default, VAT should be included.
- **Statistical Overlays:** Toggle buttons to overlay horizontal reference lines on the main chart for mathematical calculations. The reference lines explicitly state their calculated value (e.g., `Mean 9.19 ¢/kWh`) in the chart label:
  - Mean (Average)
  - Median (50th Percentile)
  - 75th Percentile
  - 90th Percentile
  - 95th Percentile

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

## 5. Non-Functional Requirements
- **Performance:** Fast initial load utilizing Next.js Server-Side Rendering (SSR) capabilities where applicable, though most data fetching will be Client-Side due to dynamic time dependencies.
- **Design:** The UI must be "premium" and modern, avoiding default browser aesthetics. It should utilize dark mode (`#09090b` background), smooth generic fonts (`Inter`), and sleek scrollbars.
- **Responsiveness:** The layout must gracefully degrade from a multi-column desktop layout to a stacked, single-column layout on mobile devices. Text wrapping and header padding should dynamically adjust to prevent awkwardly broken sentences on wide screens or cramped text on mobiles.
- **Error Handling:** Graceful error states if the Elering API is unreachable or returns malformed payloads.

## 6. Future Considerations (Out of Scope for MVP)
- Multi-region support (e.g., adding Finland, Latvia, Lithuania).
- Long-term historical data ranges (e.g., past 30 days, 1 year).
- Push notifications or alerts for price thresholds.
