# Metabase Dashboard Creator

Webapp para crear dashboards en Metabase desde especificaciones JSON. 

**Flujo simple:** Paste JSON → Run → Link a Metabase 🚀

![Screenshot](screenshot.png)

## Quick Start

```bash
docker compose up --build
```

Luego abrí http://localhost:3000

## Estructura del JSON

El JSON de especificación debe incluir las queries SQL inline. Ejemplo:

```json
{
  "meta": {
    "id": "mi_dashboard",
    "title": "Mi Dashboard de Ventas",
    "description": "Dashboard ejecutivo de ventas"
  },
  "layout": {
    "columns": 12
  },
  "filters": {
    "items": [
      {
        "id": "filter_fecha",
        "label": "Fecha",
        "type": "date_range_preset",
        "default": "last_30_days"
      }
    ]
  },
  "sections": [
    {
      "id": "section_kpis",
      "title": "KPIs Principales",
      "position": {"row": 0, "col": 0, "width": 12, "height": 2},
      "components": [
        {
          "id": "kpi_ventas",
          "type": "metric_card",
          "position": {"order": 1, "width": 3},
          "config": {
            "title": "Ventas Totales",
            "format": "number"
          },
          "query_id": "q_ventas_totales"
        },
        {
          "id": "kpi_clientes",
          "type": "metric_card",
          "position": {"order": 2, "width": 3},
          "config": {
            "title": "Clientes Activos",
            "format": "number"
          },
          "query_id": "q_clientes_activos"
        }
      ]
    },
    {
      "id": "section_grafico",
      "title": "Tendencia",
      "position": {"row": 2, "col": 0, "width": 8, "height": 4},
      "components": [
        {
          "id": "chart_tendencia",
          "type": "area_chart",
          "config": {
            "x_axis": {"field": "fecha", "label": "Fecha"},
            "y_axis": {"label": "Monto"}
          },
          "query_id": "q_tendencia_ventas"
        }
      ]
    },
    {
      "id": "section_tabla",
      "title": "Detalle por Producto",
      "position": {"row": 2, "col": 8, "width": 4, "height": 4},
      "components": [
        {
          "id": "table_productos",
          "type": "data_table",
          "config": {
            "columns": [
              {"field": "producto", "label": "Producto"},
              {"field": "ventas", "label": "Ventas", "format": "number"}
            ]
          },
          "query_id": "q_ventas_por_producto"
        }
      ]
    }
  ],
  "queries": {
    "q_ventas_totales": {
      "sql": "SELECT SUM(monto) as value FROM ventas WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'"
    },
    "q_clientes_activos": {
      "sql": "SELECT COUNT(DISTINCT cliente_id) as value FROM ventas WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'"
    },
    "q_tendencia_ventas": {
      "sql": "SELECT DATE_TRUNC('day', fecha) as fecha, SUM(monto) as monto FROM ventas WHERE fecha >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY 1"
    },
    "q_ventas_por_producto": {
      "sql": "SELECT producto, SUM(monto) as ventas FROM ventas WHERE fecha >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
    }
  }
}
```

## Tipos de Visualización Soportados

| Tipo en JSON | Tipo en Metabase |
|--------------|------------------|
| `metric_card` | Scalar |
| `area_chart` | Area |
| `line_chart` | Line |
| `bar_chart` | Bar |
| `horizontal_funnel` | Funnel |
| `donut_chart` | Pie |
| `data_table` | Table |
| `choropleth_map` | Map |

## Tipos de Filtros Soportados

- `date_range_preset` - Selector de fechas con presets
- `multi_select` - Selección múltiple
- `single_select` - Selección única
- `text` - Texto libre
- `number` - Numérico

## Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Frontend  │────▶│   Backend   │
│  (localhost │     │   (React)   │     │  (FastAPI)  │
│    :3000)   │     │   :3000     │     │   :8000     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Metabase   │
                                        │    API      │
                                        └─────────────┘
```

## API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/connections` | GET | Lista conexiones guardadas |
| `/connections` | POST | Crear/actualizar conexión |
| `/connections/{name}` | DELETE | Eliminar conexión |
| `/connections/{name}/databases` | GET | Lista databases de Metabase |
| `/connections/{name}/collections` | GET | Lista collections de Metabase |
| `/validate` | POST | Validar JSON spec |
| `/create-dashboard` | POST | Crear dashboard en Metabase |

## Desarrollo Local

Para desarrollo sin Docker:

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Notas

- Las credenciales de Metabase se guardan encriptadas en SQLite
- El session token se renueva automáticamente si expira
- El grid de 12 columnas se convierte a 24 columnas de Metabase automáticamente
