# RHR Intellicore IoT

Shift-wise industrial IoT monitoring for a cotton spinning mill: live machine telemetry,
OEE dashboards, shift clock, alarms and PDF / Excel production reports.

| Part | Stack | Port |
|------|-------|------|
| `backend/` | Java 17+, Spring Boot 3.5, Spring Security (JWT), JPA, MySQL 8, OpenPDF, Apache POI | 8085 |
| `frontend/` | React 18, Vite, Tailwind CSS (Mosaic-style layout), Chart.js, dnd-kit | 5174 |

## Run locally

1. MySQL running on `localhost:3306` (user `root`). The database `rhr_iot_dashboard` is created
   and seeded on first start (420 days of shift history, 36 h of telemetry, 12 machines).
   Copy `backend/src/main/resources/application-local.example.yml` to `application-local.yml`
   (git-ignored) and put your MySQL password there, or set `DB_USERNAME` / `DB_PASSWORD`.
2. Backend:
   ```bash
   cd backend
   mvn spring-boot:run
   ```
3. Frontend (proxies `/api` to the backend):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open http://localhost:5174

### Static accounts

| Username | Password | Mobile | Role |
|----------|----------|--------|------|
| admin | Admin@123 | 9876543210 | ADMIN |
| supervisor | Super@123 | 9876543211 | SUPERVISOR |
| operator | Oper@123 | 9876543212 | OPERATOR |

Mobile login uses the static OTP `123456` (`APP_STATIC_OTP`) until an SMS gateway is wired in.

## Pages

- **Dashboards**: tabbed. *Plant Overview* is the fixed view (OEE / Availability / Performance /
  Quality gauges plus shift-wise charts, all drag-and-drop). Users add their own tabs with
  **New dashboard** and fill them using the **widget builder**: pick a visual (stat card, bar,
  line, area, scatter, donut, table), a data table (shift production, machine telemetry, alarms,
  machine master), group-by columns and values with SUM / AVG / MIN / MAX / COUNT, then filter
  by date range, shift and machine. Widgets can be dragged, resized, duplicated and edited;
  boards can be private or shared (read-only for others).
- **Devices & Gateways**: register PLCs, HMIs, IoT gateways, edge PCs and sensors with IP / port
  and protocol, test the connection, and switch a live connector on or off.
- **View Data**: shift clock (24 h dial, countdown, next shift) and live cards per machine
  (CV%, speed, temperature, humidity, power, vibration, shift output, OEE, operator).
  Click a machine for shift A/B/C breakdown by date and live trends.
- **Reports**: date-wise, month-wise or year-wise from/to range, machine and shift filters,
  sortable paginated table with totals, PDF and Excel download.
- **Alarms**: high temperature, high CV%, vibration, fault and offline events with acknowledge.
- **Profile**: personal details, password, plant / industrial details, shift timings, IoT connectivity.

Light / dark theme toggle is in the header; sign out is in the header menu and sidebar.

## Connecting real machines

Devices are managed on the **Devices & Gateways** page (admin only):

| Protocol | What the connector does |
|----------|-------------------------|
| MQTT | Subscribes to a broker topic (wildcards allowed, optional TLS / login). Payload is a JSON reading or array; `machineCode` may be omitted when the device is mapped to a machine. |
| Modbus TCP (PLC / HMI) | Polls holding registers on an interval using a register map (address + scale per value; cumulative counters are turned into deltas). |
| OPC UA | Monitors the endpoint for reachability; values are expected through an MQTT/HTTP edge gateway. |
| HTTP push | The device POSTs to `/api/iot/telemetry` with its own generated key. |

Seeded example devices use typical `192.168.10.x` addresses and start switched off; enter
your real IPs and enable them.

Gateways POST readings to the backend with the shared device key:

```bash
curl -X POST http://localhost:8085/api/iot/telemetry \
  -H "Content-Type: application/json" -H "X-Device-Key: RHR-IOT-DEVICE-KEY-2026" \
  -d '{"machineCode":"RF-01","status":"RUNNING","speed":18200,"cvPercent":11.4,
       "temperature":33.2,"humidity":56,"powerKw":29.5,"vibration":2.8,
       "productionKg":0.03,"rejectKg":0.0002,"breaks":0}'
```

`productionKg`, `rejectKg` and `breaks` are deltas since the previous reading. Batches of up to
500 readings go to `/api/iot/telemetry/batch`. Set `APP_DEVICE_KEY` in production.

A built-in simulator (`APP_SIMULATOR=true`) feeds any machine that has no device reporting,
and steps aside automatically for 60 s after a real device reading arrives. New machines can be
registered with `POST /api/machines` (admin) and start streaming immediately.

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Shifts | `GET /api/shifts`, `GET /api/shifts/current`, `PUT /api/shifts/{code}` |
| Machines | `GET/POST /api/machines`, `GET/PUT /api/machines/{id}` |
| Live | `GET /api/live`, `GET /api/live/stream` (SSE), `GET /api/live/{id}`, `/{id}/trend?minutes=`, `/{id}/shifts?date=` |
| Dashboard | `GET /api/dashboard/summary?date=&shift=`, `GET/PUT /api/dashboard/layout` |
| Reports | `GET /api/reports?granularity=DAY|MONTH|YEAR&from=&to=&machineId=&shift=&page=&size=`, `GET /api/reports/export?format=pdf|xlsx&...` |
| Alarms | `GET /api/alarms?status=active|all`, `POST /api/alarms/{id}/ack`, `POST /api/alarms/ack-all` |
| Profile | `GET /api/profile`, `PUT /api/profile/me`, `PUT /api/profile/password`, `GET/PUT /api/profile/plant` |
| Devices | `GET /api/devices`, `GET /api/devices/protocols`, `POST/PUT/DELETE /api/devices/{id}`, `POST /api/devices/{id}/enabled`, `POST /api/devices/{id}/test`, `POST /api/devices/test`, `POST /api/devices/{id}/regenerate-key` |
| Custom dashboards | `GET/POST /api/dashboards`, `PUT/DELETE /api/dashboards/{id}`, `GET /api/query/catalog`, `POST /api/query` |
| IoT | `POST /api/iot/telemetry`, `POST /api/iot/telemetry/batch`, `GET /api/iot/status`, `PUT /api/iot/simulator` |
