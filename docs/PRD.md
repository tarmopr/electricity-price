# Product Requirements Document (PRD): Estonia Electricity Price Dashboard

## 1. Project Overview
The **Estonia Electricity Price Dashboard** is a premium, highly interactive web application designed to display real-time, historical, and forecasted electricity prices for the Estonia (EE) region. It fetches data directly from the official Elering API and presents it in a sleek, modern, dark-themed user interface.

## 2. Target Audience
- **Consumers & Homeowners:** Individuals looking to optimize their electricity usage based on spot prices (e.g., deciding when to run appliances or charge EVs).
- **Enthusiasts & Analysts:** Users interested in monitoring energy market trends and analyzing statistical price distributions.

## 3. Core Features

### 3.1. Current Price Widget
- **Live Price Display:** Shows the exact electricity price for the current 15-minute slot in cents/kWh (Elering publishes 15-minute prices).
- **Trend Indicators:** Displays the price difference (in cents/kWh) compared to both the preceding and the next 15-minute slot, with visual indicators (green for down, red for up). On narrow screens, these are displayed horizontally next to the current price to minimize vertical space and maximize chart visibility.
- **Median Context:** Displays the median price for the currently selected timeframe directly beneath the current price for quick reference.

### 3.2. Interactive Price Chart
- **Timeline Visualization:** An area chart displaying prices for the selected date range. For wider timeframes, data points are mathematically aggregated (hourly for week periods, 6-hour buckets for the last 30 days, and 1/6/12/24-hour buckets for custom ranges depending on length) to maintain high rendering performance and responsiveness.
- **Cheapest Window Highlight:** The cheapest window found by the cost calculator (section 3.5) is always shown as a highlighted band, clipped to the visible range. Its label is shown only when it fits and does not overlap the "Now" pill.
- **Min/Max Annotations:** The highest and lowest prices are marked with inline labels on the data line.
- **Visual Distinction:** Distinct color coding and styling. The past/current price area uses an ethereal teal-to-emerald gradient, while future prices use an indigo-to-violet gradient. The chart lines cast a custom neon `<filter>` drop shadow onto the background grid for added physical depth.
- **Interactivity (Focus Mode):** Support for advanced cinematic hover and touch states. When the user interacts with the chart, the background grid, axes, and statistical lines smoothly dim to 30% opacity to pull visual focus entirely to the active data curve.
- **Custom Tooltip & Cursor:** A custom soft-glowing vertical band fluidly tracks the user's cursor or finger, triggering a glassmorphism (backdrop-blur) tooltip showing exact time and price. The `activeDot` pulses with a corresponding neon glow.
- **Dynamic X-Axis:** The time axis dynamically formats based on the selected time span (e.g., `HH:mm` for daily views and Next 24h, `MMM d` for multi-day views).
- **Zoom & Scroll:** − / + buttons below the chart zoom the time axis to 1×, 2×, 4× or 8× of the visible width; a zoomed chart scrolls sideways inside its box while the price axis stays pinned on the left. Zooming keeps the viewport centre, and the zoom level survives period changes. It is not persisted.
- **Responsiveness:** Auto-scaling taking full width of the container while maintaining aspect ratio, lifting slightly on hover (`-translate-y`) alongside the main interface cards. Hover effects apply only on devices that support hover (no sticky hover on touch screens).

### 3.3. Advanced Controls & Settings
- **Timeframe Selection:** Pill buttons for the most common periods — Next 24h (from the current hour, 24 hours ahead, at raw 15-minute resolution), Yesterday, Today and Tomorrow — plus a "More" menu with This Week, Last 7 Days, Next 7 Days, Last 30 Days and Custom. Next 24h is the default for first-time visitors; a stored choice is kept.
- **Mobile Layout:** Below the `lg` breakpoint the whole period card collapses to a "Period · {label} · incl./excl. VAT" header (open by default; the choice is remembered). When open, the period pills and the VAT toggle are visible; below the `md` breakpoint the statistical overlays and the price alert sit behind a "Chart Controls" toggle to maximize chart visibility. All buttons have touch targets of at least 44 px.
- **Custom Date Range:** Date pickers to fetch and visualize historical or forecasted electricity prices for any custom start and end date combination. Elering API constraints are bypassed by automatically chunking large requests.
- **VAT Toggle:** A button allowing users to instantly recalculate all displayed prices to either include or exclude the Estonian Value Added Tax (VAT), which is currently 22%. By default, VAT should be included.
- **Advanced Chart Settings (Statistical Overlays):** Toggles to overlay horizontal reference lines on the main chart for mathematical calculations. The reference lines explicitly state their calculated value (e.g., `Mean 9.19 ¢/kWh`):
  - Mean (Average)
  - Median (50th Percentile)
  - 75th Percentile
  - 90th Percentile
  - 95th Percentile
  - 7-Day and 30-Day hourly average patterns
- **View Mode:** Switch between the chart and the heatmap (section 3.6).
- **Future Price Prediction:** Uses a statistical model blending the identical hour from yesterday and 7 days ago to predict upcoming prices if the official API payload is incomplete for future hours.

### 3.4. Auto-Refresh Mechanism
- The dashboard must automatically poll the API or refresh its data state on a reasonable interval (e.g., every 15 minutes) to ensure the "Current Price" widget accurately rolls over without requiring a manual page reload.
- The cost calculator's prices refresh every 15 minutes, when a phone tab becomes visible again (skipped if the last successful load is under 60 seconds old) and when the network comes back. "Now" advances to the current 15-minute slot every minute.

### 3.5. Best Time Card & Cost Calculator
- **Purpose:** Answer "when should I run this, and what will it cost?" — e.g. the cheapest night window to charge an EV.
- **Best Time Card:** Shown at the top of the page (directly under the current price on mobile, full width under the top row on desktop). Shows the preset name, the recommended window with day context (e.g. "Tonight 23:00 – Tomorrow 07:00"), cost in €, average ¢/kWh, savings vs. starting now, the ready-by time and a "Predicted" badge when the window uses predicted prices. Tapping it opens and scrolls to the cost calculator; when no window fits, it also opens the calculator settings.
- **Rolling Horizon:** The search is independent of the chart period. It covers now (floored to 15 minutes) to the end of tomorrow (Europe/Tallinn), including predicted prices when tomorrow's official prices are not yet published (unless "Use predicted prices" is off), so windows can cross midnight. With predictions excluded only the window search is limited to official prices; Starting Now, Next-hours average and Peak still include them, and a note says so.
- **Inputs:**
  - Presets, in this order: Plug-in Hybrid (14 kWh, 8 h, ready by 07:00), EV Charge (40 kWh, 8 h, ready by 07:00, the default), Washing Machine (2 kWh, 2 h), Dryer (3.5 kWh, 2 h), Dishwasher (1.8 kWh, 2 h, ready by 07:00), Sauna (15 kWh, 3 h). Editing any value switches the preset to "Custom".
  - Consumption 0–200 kWh (step 0.5) and duration 0.25–24 h (15-minute resolution); decimals with a comma or a dot.
  - "Ready by": a native time picker in 15-minute steps, or "No limit".
  - "Use predicted prices" toggle (on by default): when off, the best-window search uses official prices only and, when official prices end before the ready-by time, a hint shows where they end.
- **Settings:** The inputs sit behind their own toggle inside the open calculator, collapsed by default, so the results stay in view. A short summary (preset, kWh, duration, ready-by, and "official prices only" when predictions are excluded) shows while collapsed. The calculator header still collapses everything.
- **Ready-by Rules:** The window must end at or before the next occurrence of the ready-by time (DST-safe). Only when less than half the duration remains until that time is the following day's occurrence used. If no window fits before the deadline, the cheapest full-length window is recommended anyway with an amber "Finishes after HH:MM" warning and when starting now would finish. With predicted prices excluded, the search also ends where official prices end; if no window fits before then, a message says so.
- **Estimates:** Starting Now, Best Window, Next-hours average and Peak (the last two behind "Show more" on mobile), plus the savings of the best window vs. starting now (shown from €0.01).
- **Numeric Fields:** The field keeps what is typed: it can be cleared without a 0 or 1 being re-inserted, results update live on every valid keystroke, out-of-range values are clamped with an inline hint (e.g. "max 200 kWh"), unparseable text shows "Enter a number", and the value is normalized on blur or Done. The text is selected on tap, and − / + steppers are available.
- **States:** Loading skeleton, "Couldn't load prices — retrying automatically", "No price data available yet", and a "showing the last loaded data" notice when a refresh fails while an earlier result is still shown.
- **Persistence:** Consumption, duration, ready-by, preset, the "Use predicted prices" choice and the open/closed state of the calculator and its settings are saved in `localStorage`. A legacy integer "until hour" setting is migrated to ready-by (the untouched old default 22:00 is dropped in favour of 07:00).

### 3.6. Heatmap
- **Calendar mode:** Day × hour grid of prices for the selected period, color-coded green → red, with predicted values washed out and the cheapest window's hours marked. Single-day periods, This Week and Next 24h expand to the containing week with the selected dates highlighted.
- **Weekly Pattern mode:** Average price per weekday × hour.
- **Mobile:** The grid is transposed (hours as rows, days as columns) to fit the phone width without horizontal scrolling; tapping a cell shows its price.

### 3.7. Price Alerts
- Threshold in ¢/kWh (negative values allowed, down to −50) with "below" or "above" direction. When the current price crosses it, an in-page banner appears, plus a browser notification if permission is granted.

### 3.8. Share & Preferences
- **Share:** Copies a link encoding period, VAT setting, view mode and custom range (native share sheet where available), with a "Link copied" confirmation.
- **Preferences:** VAT, period, overlays (including the Now line), view mode, alert and calculator settings persist in `localStorage` (custom date ranges are not persisted).

## 4. Technical Specifications

### 4.1. Architecture & Stack
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom dark theme, glassmorphism UI)
- **Charting Library:** Recharts
- **Icons:** Lucide-react
- **Animation:** Framer Motion (animated current price)
- **Runtime & Storage:** Cloudflare Workers via OpenNext, Cloudflare D1 for historical prices and aggregates

### 4.2. External APIs
- **Provider:** Elering AS Dashboard API
- **Endpoints:**
  - `GET https://dashboard.elering.ee/api/nps/price/EE/current`
  - `GET https://dashboard.elering.ee/api/nps/price?start={iso_start}&end={iso_end}`
- **Data Transformation:** The API returns payloads in `€/MWh` and Unix timestamps. The application converts these to `¢/kWh` (divide by 10) and shows all times in Estonian time (Europe/Tallinn), independent of the browser timezone.
- **Server-Side Proxy:** The browser never calls Elering directly: it uses the app's own API routes (`/api/prices`, `/api/prices/current`, and D1-backed aggregate routes), which run on Cloudflare Workers.
- **Chunking Mechanism:** To bypass the Elering API's payload size limits, requests spanning long historical periods are automatically chunked server-side into 90-day intervals.

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
- Push notifications for price thresholds when the page is closed (alerts currently work while the page is open).
- User accounts / preferences synced across devices (preferences are currently stored per browser).
