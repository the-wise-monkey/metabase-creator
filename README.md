# Metabase Creator

Create Metabase dashboards from JSON specifications. Paste JSON, run, get dashboard link.

## Quick Start

### Single Container (Recommended)
```bash
docker build -t metabase-creator .
docker run -p 8000:8000 -v ./data:/app/data metabase-creator
```
Open http://localhost:8000

### Docker Compose
```bash
docker compose up --build
```
Open http://localhost:3000

## How It Works

1. **Connect** - Add your Metabase URL and credentials
2. **Configure** - Select database, paste your JSON spec
3. **Create** - Click create, get a link to your new dashboard

## JSON Specification

See [examples/product_metrics.json](examples/product_metrics.json) for a complete example.

```json
{
  "meta": {
    "title": "My Dashboard",
    "description": "Executive dashboard"
  },
  "sections": [
    {
      "id": "section_kpis",
      "title": "KPIs",
      "position": {"row": 0, "col": 0, "width": 12, "height": 2},
      "components": [
        {
          "id": "kpi_total",
          "type": "metric_card",
          "position": {"order": 1, "width": 3},
          "config": {"title": "Total Sales", "format": "number"},
          "query_id": "q_total_sales"
        }
      ]
    }
  ],
  "queries": {
    "q_total_sales": {
      "sql": "SELECT SUM(amount) as value FROM sales"
    }
  }
}
```

## Visualization Types

| JSON Type | Metabase Type |
|-----------|---------------|
| `metric_card` | Scalar |
| `area_chart` | Area |
| `line_chart` | Line |
| `bar_chart` | Bar |
| `horizontal_funnel` | Funnel |
| `donut_chart` | Pie |
| `data_table` | Table |
| `choropleth_map` | Map |

## Filter Types

| Type | Description |
|------|-------------|
| `date_range_preset` | Date picker with presets |
| `multi_select` | Multiple selection |
| `single_select` | Single selection |
| `text` | Free text |
| `number` | Numeric |

## Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API

All endpoints prefixed with `/api`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/connections` | GET | List connections |
| `/api/connections` | POST | Create connection |
| `/api/connections/{name}` | DELETE | Delete connection |
| `/api/connections/{name}/databases` | GET | List databases |
| `/api/connections/{name}/collections` | GET | List collections |
| `/api/validate` | POST | Validate JSON spec |
| `/api/create-dashboard` | POST | Create dashboard |

## Notes

- Credentials stored encrypted (SQLite)
- Session tokens auto-renewed on expiry
- 12-column grid converts to Metabase's 24-column grid
- SSL verification disabled for self-signed certs
