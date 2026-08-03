# Playbook — Write an API Endpoint

> The procedure for adding a route handler. Pairs with `patterns/api-pattern.md` (the shape)
> and `skills/backend/create-api-endpoint.md` (the craft).

## 1. Define the contract first
- Method + path (`app/api/<resource>/[id]/route.ts`).
- Request schema (zod, in `lib/schemas/`) and response envelope (`{ data }` / `{ error }`).
- Auth: who can call it? Which authz permission (`resource:action`)?
- Idempotency: is retry-safe needed (especially for AI-invoked endpoints)?
- Record the contract in `knowledge/api/` (endpoint catalog).

## 2. Implement thinly
- Handler order: auth → validate → authorize → delegate to service → respond.
- No business logic or DB access in the handler — that lives in the service + DAL.

## 3. Error & edge handling
- Map errors to correct status codes (400/401/403/404/409/422/500).
- Handle empty results, invalid ids, and permission failures explicitly.
- Never leak Mongo/stack details to the client.

## 4. Test
- Unit-test the service; integration-test the route (happy path + 401 + 403 + 400 + 404).

## 5. Document
- Add/update the endpoint in `knowledge/api/`.
- If this endpoint shape is new, ensure `patterns/api-pattern.md` still represents it; update
  if the pattern evolved.
- Update `memory/` per the Documentation Rules.
