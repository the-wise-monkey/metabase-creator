# Single Dockerfile for full-stack deployment
# Build: docker build -t metabase-creator .
# Run: docker run -p 8000:8000 -v ./data:/app/data metabase-creator

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + static frontend
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./static

# Create data directory
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:///./data/app.db

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
