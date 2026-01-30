# Metabase Creator

Web app to create Metabase dashboards from JSON specifications.

**Simple flow:** Paste JSON → Run → Get Metabase link

## Quick Start

### Single Container (Recommended)
```bash
docker build -t metabase-editor .
docker run -p 8000:8000 -v ./data:/app/data metabase-editor
```
Open http://localhost:8000

### Docker Compose
```bash
docker compose up --build
```
Open http://localhost:3000

## JSON Specification

The JSON spec must include SQL queries inline. See [examples/product_metrics.json](examples/product_metrics.json) for a complete example.

```json
{
  "meta": {
    "id": "my_dashboard",
    "title": "My Dashboard",
    "description": "Executive dashboard"
  },
  "layout": {
    "columns": 12
  },
  "filters": {
    "items": [
      {
        "id": "filter_date",
        "label": "Date",
        "type": "date_range_preset",
        "default": "last_30_days"
      }
    ]
  },
  "sections": [
    {
      "id": "section_kpis",
      "title": "Main KPIs",
      "position": {"row": 0, "col": 0, "width": 12, "height": 2},
      "components": [
        {
          "id": "kpi_total",
          "type": "metric_card",
          "position": {"order": 1, "width": 3},
          "config": {
            "title": "Total Sales",
            "format": "number"
          },
          "query_id": "q_total_sales"
        }
      ]
    }
  ],
  "queries": {
    "q_total_sales": {
      "sql": "SELECT SUM(amount) as value FROM sales WHERE date >= CURRENT_DATE - INTERVAL '30 days'"
    }
  }
}
```

## Supported Visualization Types

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

## Supported Filter Types

- `date_range_preset` - Date picker with presets
- `multi_select` - Multiple selection
- `single_select` - Single selection
- `text` - Free text
- `number` - Numeric

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Frontend  │────▶│   Backend   │
│             │     │   (React)   │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Metabase   │
                                        │    API      │
                                        └─────────────┘
```

## API Endpoints

All endpoints are prefixed with `/api`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/connections` | GET | List saved connections |
| `/api/connections` | POST | Create/update connection |
| `/api/connections/{name}` | DELETE | Delete connection |
| `/api/connections/{name}/databases` | GET | List Metabase databases |
| `/api/connections/{name}/collections` | GET | List Metabase collections |
| `/api/validate` | POST | Validate JSON spec |
| `/api/create-dashboard` | POST | Create dashboard in Metabase |

## Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Notes

- Metabase credentials are stored encrypted in SQLite
- Session tokens are automatically renewed on expiry
- The 12-column grid is converted to Metabase's 24-column grid automatically
- SSL certificate verification is disabled for local/self-signed certs
