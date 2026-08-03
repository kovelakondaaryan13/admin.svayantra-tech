# knowledge/database

The MongoDB data model — collections, schemas, indexes, relationships, access patterns. Keep
in sync with the DAL (`data/*`) and the index definitions (Documentation Rules).

## What lives here
- `collections.md` — one section per collection: purpose, schema, indexes, relationships,
  validation, growth expectation, access patterns, example doc.
- `indexes.md` — the authoritative index list (mirrors `data/indexes.ts`).

## Planned collections (from `PROJECT.md` — schemas pending blueprint Part 5)
`users`, `sessions`, `organizations`, `companies`, `contacts`, `leads`, `tasks`, `meetings`,
`activities`, `assignments`, `proposals`, `quotations`, `notifications`, `auditLogs`,
`aiConversations`, `aiMemory`, `knowledgeIndex` (pointers to Notion).

## Conventions (seeded)
- Every doc: `_id`, `createdAt`, `updatedAt`; multi-tenant scope via `orgId`.
- Soft-delete revenue data (`deletedAt`); hard-delete only via an audited path.
- Every hot-path query is indexed. See `../../patterns/database-pattern.md` and
  `../../skills/database/design-schema.md`.

_(Detailed schemas added as collections are designed/built.)_
