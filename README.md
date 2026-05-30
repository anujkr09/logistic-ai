# ZYRAVIQ AI Logistics (AI-powered logistics & shipment tracking)

Modern enterprise-grade logistics management system for shipment tracking, warehouse management, fraud detection, and AI-guided logistics recommendations.

## Tech stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js + Express + Socket.io + MongoDB (Mongoose)
- AI microservice: Python FastAPI
- Auth: JWT Authentication with multi-tenant `companyId`
- Deployment: Docker Compose

## Local run
1. Install dependencies
   - `cd backend && npm install`
   - `cd ai-service && pip install -r requirements.txt`
   - `cd frontend && npm install`
2. Start MongoDB locally or use Docker Compose
3. Start the AI service
   - `cd ai-service && python main.py`
4. Start the backend
   - `cd backend && node src/server.js`
5. Start the frontend server
   - `cd frontend && node server.js`
6. Open in browser
   - `http://localhost:3000`

## Docker Compose
From the `deployment` folder:

```bash
cd deployment
docker compose up --build
```

This will launch:
- `mongo` on port `27017`
- `ai-service` on port `8001`
- `backend` on port `4000`
- `frontend` on port `3000`

## Environment variables
Copy `.env.example` to `.env` for both backend and AI service and configure values before running.

### Backend sample
- `PORT=4000`
- `JWT_SECRET=replace_with_a_long_random_secret`
- `JWT_EXPIRES_IN=7d`
- `MONGODB_URI=mongodb://mongo:27017/zyraviq_ai_logistics`
- `AI_SERVICE_URL=http://ai-service:8001`
- `CORS_ORIGIN=http://localhost:3000`
- `SOCKET_CORS_ORIGIN=http://localhost:3000`

### AI service sample
- `OPENAI_API_KEY=`

## API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/shipments`
- `POST /api/shipments`
- `POST /api/shipments/assign`
- `GET /api/shipments/track/:trackingNumber`
- `GET /api/warehouses`
- `POST /api/warehouses`
- `GET /api/analytics/customer`
- `GET /api/analytics/admin/summary`
- `GET /api/fraud/alerts`
- `GET /api/ai/recommendations`

## Notes
- The frontend currently uses local storage for JWT tokens.
- The AI service implements placeholder heuristics for ETA estimation, fraud detection, and recommendations.
- Docker Compose is configured in `deployment/docker-compose.yml`.

