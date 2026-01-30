from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, Column, String, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import httpx
import json
import os
from cryptography.fernet import Fernet
import base64
import hashlib

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Encryption key (derived from a fixed seed for simplicity - in production use env var)
ENCRYPTION_KEY = base64.urlsafe_b64encode(hashlib.sha256(b"metabase-dashboard-creator-key").digest())
fernet = Fernet(ENCRYPTION_KEY)

class MetabaseConnection(Base):
    __tablename__ = "metabase_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    url = Column(String)
    username = Column(String)
    password_encrypted = Column(Text)
    session_token = Column(Text, nullable=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Metabase Dashboard Creator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models
class ConnectionCreate(BaseModel):
    name: str = "default"
    url: str = Field(..., description="Metabase URL (e.g., http://localhost:3001)")
    username: str
    password: str

class ConnectionResponse(BaseModel):
    id: int
    name: str
    url: str
    username: str
    is_connected: bool = False

class DashboardSpec(BaseModel):
    spec: Dict[str, Any]
    connection_name: str = "default"
    database_id: int = Field(..., description="Metabase database ID to use for queries")
    collection_id: Optional[int] = None

class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    summary: Dict[str, Any] = {}

# Metabase API client
class MetabaseClient:
    def __init__(self, base_url: str, session_token: str):
        self.base_url = base_url.rstrip('/')
        self.session_token = session_token
        self.headers = {"X-Metabase-Session": session_token}
    
    async def get(self, endpoint: str) -> Dict:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                f"{self.base_url}/api{endpoint}",
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def post(self, endpoint: str, data: Dict) -> Dict:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{self.base_url}/api{endpoint}",
                headers=self.headers,
                json=data,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def put(self, endpoint: str, data: Dict) -> Dict:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                f"{self.base_url}/api{endpoint}",
                headers=self.headers,
                json=data,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

async def get_metabase_session(url: str, username: str, password: str) -> str:
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.post(
            f"{url.rstrip('/')}/api/session",
            json={"username": username, "password": password},
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()["id"]

# Visualization type mapping
VIZ_TYPE_MAP = {
    "metric_card": "scalar",
    "metric_card_with_status": "scalar",
    "area_chart": "area",
    "line_chart": "line",
    "bar_chart": "bar",
    "horizontal_funnel": "funnel",
    "donut_chart": "pie",
    "choropleth_map": "map",
    "data_table": "table",
}

def map_visualization_type(spec_type: str) -> str:
    return VIZ_TYPE_MAP.get(spec_type, "table")

def convert_grid_position(spec_pos: Dict, spec_columns: int = 12) -> Dict:
    """Convert from spec grid (12 cols) to Metabase grid (24 cols)"""
    scale = 24 / spec_columns
    return {
        "col": int(spec_pos.get("col", 0) * scale),
        "row": int(spec_pos.get("row", 0)),
        "size_x": int(spec_pos.get("width", 4) * scale),
        "size_y": int(spec_pos.get("height", 4)),
    }

# Routes
@app.get("/")
async def root():
    return {"status": "ok", "message": "Metabase Dashboard Creator API"}

@app.post("/connections", response_model=ConnectionResponse)
async def create_connection(conn: ConnectionCreate, db: Session = Depends(get_db)):
    # Check if connection exists
    existing = db.query(MetabaseConnection).filter(MetabaseConnection.name == conn.name).first()
    
    # Test connection
    try:
        session_token = await get_metabase_session(conn.url, conn.username, conn.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not connect to Metabase: {str(e)}")
    
    encrypted_password = fernet.encrypt(conn.password.encode()).decode()
    
    if existing:
        existing.url = conn.url
        existing.username = conn.username
        existing.password_encrypted = encrypted_password
        existing.session_token = session_token
        db.commit()
        db.refresh(existing)
        return ConnectionResponse(
            id=existing.id,
            name=existing.name,
            url=existing.url,
            username=existing.username,
            is_connected=True
        )
    
    new_conn = MetabaseConnection(
        name=conn.name,
        url=conn.url,
        username=conn.username,
        password_encrypted=encrypted_password,
        session_token=session_token
    )
    db.add(new_conn)
    db.commit()
    db.refresh(new_conn)
    
    return ConnectionResponse(
        id=new_conn.id,
        name=new_conn.name,
        url=new_conn.url,
        username=new_conn.username,
        is_connected=True
    )

@app.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(db: Session = Depends(get_db)):
    connections = db.query(MetabaseConnection).all()
    return [
        ConnectionResponse(
            id=c.id,
            name=c.name,
            url=c.url,
            username=c.username,
            is_connected=c.session_token is not None
        )
        for c in connections
    ]

@app.get("/connections/{name}")
async def get_connection(name: str, db: Session = Depends(get_db)):
    conn = db.query(MetabaseConnection).filter(MetabaseConnection.name == name).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return ConnectionResponse(
        id=conn.id,
        name=conn.name,
        url=conn.url,
        username=conn.username,
        is_connected=conn.session_token is not None
    )

@app.delete("/connections/{name}")
async def delete_connection(name: str, db: Session = Depends(get_db)):
    conn = db.query(MetabaseConnection).filter(MetabaseConnection.name == name).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"status": "deleted"}

@app.get("/connections/{name}/databases")
async def get_databases(name: str, db: Session = Depends(get_db)):
    conn = db.query(MetabaseConnection).filter(MetabaseConnection.name == name).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    if not conn.session_token:
        # Try to reconnect
        password = fernet.decrypt(conn.password_encrypted.encode()).decode()
        conn.session_token = await get_metabase_session(conn.url, conn.username, password)
        db.commit()
    
    client = MetabaseClient(conn.url, conn.session_token)
    try:
        databases = await client.get("/database")
        return databases
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            # Token expired, reconnect
            password = fernet.decrypt(conn.password_encrypted.encode()).decode()
            conn.session_token = await get_metabase_session(conn.url, conn.username, password)
            db.commit()
            client = MetabaseClient(conn.url, conn.session_token)
            return await client.get("/database")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))

@app.get("/connections/{name}/collections")
async def get_collections(name: str, db: Session = Depends(get_db)):
    conn = db.query(MetabaseConnection).filter(MetabaseConnection.name == name).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    if not conn.session_token:
        password = fernet.decrypt(conn.password_encrypted.encode()).decode()
        conn.session_token = await get_metabase_session(conn.url, conn.username, password)
        db.commit()
    
    client = MetabaseClient(conn.url, conn.session_token)
    try:
        collections = await client.get("/collection")
        return collections
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            password = fernet.decrypt(conn.password_encrypted.encode()).decode()
            conn.session_token = await get_metabase_session(conn.url, conn.username, password)
            db.commit()
            client = MetabaseClient(conn.url, conn.session_token)
            return await client.get("/collection")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))

@app.post("/validate")
async def validate_spec(spec: Dict[str, Any]):
    """Validate the dashboard specification JSON"""
    errors = []
    warnings = []
    summary = {}
    
    # Check required top-level fields
    required_fields = ["meta", "sections"]
    for field in required_fields:
        if field not in spec:
            errors.append(f"Missing required field: {field}")
    
    if "meta" in spec:
        meta = spec["meta"]
        summary["title"] = meta.get("title", "Untitled")
        summary["description"] = meta.get("description", "")
    
    # Check sections
    if "sections" in spec:
        sections = spec["sections"]
        summary["sections_count"] = len(sections)
        
        components_count = 0
        queries_needed = set()
        
        for section in sections:
            if "components" not in section:
                warnings.append(f"Section '{section.get('id', 'unknown')}' has no components")
                continue
            
            for component in section["components"]:
                components_count += 1
                if "query_id" in component:
                    queries_needed.add(component["query_id"])
                
                # Check if query is defined
                if "query_id" in component:
                    query_id = component["query_id"]
                    queries = spec.get("queries", {})
                    if query_id not in queries:
                        errors.append(f"Component '{component.get('id', 'unknown')}' references undefined query: {query_id}")
        
        summary["components_count"] = components_count
        summary["queries_count"] = len(queries_needed)
    
    # Check queries have SQL
    if "queries" in spec:
        for query_id, query_def in spec["queries"].items():
            if "sql" not in query_def and "file" in query_def:
                warnings.append(f"Query '{query_id}' references external file - SQL must be inline")
    
    # Check filters
    if "filters" in spec:
        summary["filters_count"] = len(spec["filters"].get("items", []))
    
    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        summary=summary
    )

@app.post("/create-dashboard")
async def create_dashboard(request: DashboardSpec, db: Session = Depends(get_db)):
    """Create a complete dashboard in Metabase from the specification"""
    
    conn = db.query(MetabaseConnection).filter(MetabaseConnection.name == request.connection_name).first()
    if not conn:
        raise HTTPException(status_code=404, detail=f"Connection '{request.connection_name}' not found")
    
    if not conn.session_token:
        password = fernet.decrypt(conn.password_encrypted.encode()).decode()
        conn.session_token = await get_metabase_session(conn.url, conn.username, password)
        db.commit()
    
    client = MetabaseClient(conn.url, conn.session_token)
    spec = request.spec
    
    try:
        # 1. Create the dashboard
        meta = spec.get("meta", {})
        dashboard_data = {
            "name": meta.get("title", "Imported Dashboard"),
            "description": meta.get("description", ""),
        }
        if request.collection_id:
            dashboard_data["collection_id"] = request.collection_id
        
        dashboard = await client.post("/dashboard", dashboard_data)
        dashboard_id = dashboard["id"]
        
        # 2. Create cards for each component
        created_cards = []
        card_positions = []
        queries = spec.get("queries", {})
        grid_columns = spec.get("layout", {}).get("columns", 12)
        
        for section in spec.get("sections", []):
            section_pos = section.get("position", {"row": 0, "col": 0, "width": 12, "height": 4})
            
            for idx, component in enumerate(section.get("components", [])):
                query_id = component.get("query_id")
                if not query_id or query_id not in queries:
                    continue
                
                query_def = queries[query_id]
                sql = query_def.get("sql", f"-- Query: {query_id}\nSELECT 1")
                
                # Create the card/question
                viz_type = map_visualization_type(component.get("type", "data_table"))
                config = component.get("config", {})
                
                card_data = {
                    "name": config.get("title", component.get("id", f"Card {idx}")),
                    "dataset_query": {
                        "type": "native",
                        "native": {
                            "query": sql,
                            "template-tags": {}
                        },
                        "database": request.database_id
                    },
                    "display": viz_type,
                    "visualization_settings": build_viz_settings(component),
                }
                if request.collection_id:
                    card_data["collection_id"] = request.collection_id
                
                card = await client.post("/card", card_data)
                created_cards.append(card)
                
                # Calculate position
                comp_pos = component.get("position", {})
                if "order" in comp_pos:
                    # Horizontal layout within section
                    width = comp_pos.get("width", 3)
                    pos = {
                        "col": section_pos.get("col", 0) + (comp_pos["order"] - 1) * width,
                        "row": section_pos.get("row", 0),
                        "width": width,
                        "height": section_pos.get("height", 4)
                    }
                else:
                    pos = section_pos.copy()
                
                mb_pos = convert_grid_position(pos, grid_columns)
                card_positions.append({
                    "id": card["id"],
                    "card_id": card["id"],
                    **mb_pos
                })
        
        # 3. Add cards to dashboard
        if card_positions:
            await client.put(f"/dashboard/{dashboard_id}", {
                "dashcards": card_positions
            })
        
        # 4. Add filters/parameters
        parameters = build_parameters(spec.get("filters", {}))
        if parameters:
            await client.put(f"/dashboard/{dashboard_id}", {
                "parameters": parameters
            })
        
        dashboard_url = f"{conn.url}/dashboard/{dashboard_id}"
        
        return {
            "success": True,
            "dashboard_id": dashboard_id,
            "dashboard_url": dashboard_url,
            "cards_created": len(created_cards),
            "message": f"Dashboard created successfully with {len(created_cards)} cards"
        }
        
    except httpx.HTTPStatusError as e:
        error_detail = str(e)
        try:
            error_detail = e.response.json()
        except:
            pass
        raise HTTPException(status_code=e.response.status_code, detail=error_detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def build_viz_settings(component: Dict) -> Dict:
    """Build Metabase visualization settings from component config"""
    config = component.get("config", {})
    comp_type = component.get("type", "")
    settings = {}
    
    if comp_type in ["metric_card", "metric_card_with_status"]:
        settings["scalar.field"] = "value"
        if config.get("format") == "percentage":
            settings["number_style"] = "percent"
        elif config.get("format") == "number_abbreviated":
            settings["number_style"] = "compact"
    
    elif comp_type == "data_table":
        columns = config.get("columns", [])
        settings["table.columns"] = [
            {"name": col.get("field"), "enabled": True}
            for col in columns
        ]
    
    elif comp_type in ["area_chart", "line_chart", "bar_chart"]:
        if "x_axis" in config:
            settings["graph.x_axis.title_text"] = config["x_axis"].get("label", "")
        if "y_axis" in config:
            settings["graph.y_axis.title_text"] = config["y_axis"].get("label", "")
    
    elif comp_type == "donut_chart":
        settings["pie.show_legend"] = config.get("show_legend", True)
        settings["pie.show_total"] = config.get("show_center_total", True)
    
    return settings

def build_parameters(filters_spec: Dict) -> List[Dict]:
    """Build Metabase parameters from filters specification"""
    parameters = []
    
    for item in filters_spec.get("items", []):
        param = {
            "id": item.get("id"),
            "name": item.get("label", item.get("id")),
            "slug": item.get("id"),
            "type": map_filter_type(item.get("type", "text")),
        }
        
        if item.get("default") and item.get("default") != "all":
            param["default"] = item.get("default")
        
        parameters.append(param)
    
    return parameters

def map_filter_type(spec_type: str) -> str:
    """Map spec filter types to Metabase parameter types"""
    type_map = {
        "date_range_preset": "date/all-options",
        "multi_select": "string/=",
        "single_select": "string/=",
        "text": "string/contains",
        "number": "number/=",
    }
    return type_map.get(spec_type, "string/=")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
