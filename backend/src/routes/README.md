Backend route list:
- POST /api/auth/login
- POST /api/auth/register
- GET /api/shipments/track/:trackingNumber
- GET /api/shipments
- POST /api/shipments
- POST /api/shipments/assign
- PATCH /api/shipments/status
- GET /api/shipments/admin
- GET /api/warehouses
- POST /api/warehouses
- GET /api/warehouses/summary
- GET /api/analytics/customer
- GET /api/analytics/admin/summary
- GET /api/notifications
- POST /api/chat
- GET /api/fraud/alerts
- POST /api/fraud/report
- GET /api/ai/recommendations
- POST /api/ai/recommendations/refresh
- GET /api/ui/public-schema/:page
- GET /api/ui/schema/:page
- POST /api/ui/action
- GET /api/workspace/items
- POST /api/workspace/items

These routes are implemented in the adjacent route modules. Some endpoints still use deterministic fallback logic when AI or cached analytics data is unavailable, but they no longer return blanket 501 placeholder responses.
