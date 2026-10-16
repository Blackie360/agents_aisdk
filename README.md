# SchemaMind

Explore database and ORM schema files without connecting to a live database. SchemaMind 0.2 turns supported definitions into interactive diagrams, field details and portable exports. Document schemas use a nested structure view rather than invented relational edges.

## Run locally

Requires Node.js **22.12+** (tested on 24) and npm. No AI or database credentials are needed.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production build: `npm run build && npm start`.

## Import workflow

- Paste a schema or open `.sql`, `.prisma`, `.ts`, `.js` or `.json` files.
- **Auto-detect** recognizes Prisma, Drizzle imports, TypeORM EntitySchema JSON and document JSON Schema. SQL-specific tokens can suggest PostgreSQL, MySQL or SQLite; shared/ambiguous SQL requires an explicit dialect choice. Detection is heuristic, with a manual override.
- **Find schemas in a project folder** lists likely schema files from a locally selected repository. It excludes `.git`, dependencies and build output; only a selected file is read. Up to 100 candidates are shown. Directory picking depends on browser support; Open file is the fallback.
- Click **Visualize schema**. Drag nodes, pan/zoom, select an entity, inspect fields and read import notes.
- Imports run in an on-demand browser worker using the shared parsers. Schema text is not sent to the server for diagrams. The worker uses parser defaults, never local configuration files, and is terminated after each import or a 30-second timeout. AI is a separate, explicit server request.
- Export the shared model as JSON, including warnings. Relational schemas also export Mermaid ERD with sanitized identifiers. Mermaid is a diagram, not a lossless SQL export; JSON preserves original names and compound keys.

This release does **not** connect to GitHub repositories, introspect running databases, run migration scripts, or execute uploaded JavaScript/TypeScript. Drizzle definitions split across files must be combined manually; imports are not followed. Choosing a local folder is file discovery, not a persistent repository grant.

## Tested support matrix

All importers produce the model in `lib/types/schema.ts`. Support is deliberately bounded; this is not universal database/ORM support.

| Input                     | Implemented and tested                                                                                                                                                                                                                                           | Exclusions / behavior                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL DDL            | CREATE TABLE; qualified table names; scalar/array types; inline/table PK, UNIQUE and FK; compound keys/pairs; nullability and defaults                                                                                                                           | `pgsql-ast-parser` grammar subset; REFERENCES must include the target column list (for example `REFERENCES users(id)`). Omitted lists are rejected by the upstream grammar. Other parsed statements warn and are omitted. Indexes, CHECK expressions and foreign-key actions are retained as metadata. ALTER migrations, inheritance expansion, views, triggers, policies and generated expressions are not modeled. Unsupported table syntax fails; unsupported index syntax warns. |
| MySQL DDL                 | CREATE TABLE; backticks; AUTO_INCREMENT; nullability; defaults; inline/table and compound keys/FKs                                                                                                                                                               | MySQL grammar via `node-sql-parser`. No migration evaluation, engine/collation semantics, index/CHECK/generated-column modeling.                                                                                                                                                                                                                                                                        |
| SQLite DDL                | CREATE TABLE; INTEGER PK; inline/table references; compound keys and defaults                                                                                                                                                                                    | SQLite grammar via `node-sql-parser`. Not a SQLite validator; no affinity, virtual tables or rowid semantics. Non-INTEGER PK fields retain declared nullability.                                                                                                                                                                                                                                        |
| Prisma                    | Relational models; scalar/list fields; enum type names; single/compound keys; explicit relation fields and references; self/multiple targets                                                                                                                     | Navigation fields are not physical columns. Implicit relations warn and are omitted. Logical names shown; mappings/native attributes/indexes/actions are not modeled. MongoDB provider/composite types rejected. Enum values not modeled.                                                                                                                                                               |
| Drizzle TypeScript        | Named (including aliased) imports from `drizzle-orm/pg-core`, `mysql-core`, `sqlite-core`; literal pgTable/mysqlTable/sqliteTable definitions; supported scalar builders; primaryKey/notNull/unique/default/array; inline references to tables in the same input | Parsed with TypeScript AST, never executed. Dynamic helpers/spreads, custom types, namespace imports, pgSchema, relations(), builder options, table config/compound keys/indexes and cross-file resolution are unsupported. Unsupported structures warn or fail when no entity is found. SQL aliases are not applied; property names are shown.                                                         |
| TypeORM EntitySchema JSON | Single options object or array; string column types; PK/UNIQUE and compound unique; explicit owning one-to-one/many-to-one join columns                                                                                                                          | Not decorators or executable JS. Join columns must exist explicitly. No inferred columns, automatic junction tables, inheritance, embedded entities, physical name mapping or index semantics.                                                                                                                                                                                                          |
| Document JSON Schema      | Root properties; nested objects; arrays of objects/scalars; required versus nullable; type/description/default                                                                                                                                                   | Structural visualization, not validation. `$ref`, definitions, composition and validation keywords warn; no fetching external refs. No inferred FK/ERD. Not raw documents or MongoDB validator syntax.                                                                                                                                                                                                  |

Limits: 200 KB schema text, 150 entities, 3,000 fields, and 20 nested document levels. Invalid syntax, duplicates or missing foreign-key fields fail. Missing referenced entities warn and omit the edge. Warnings accompany every export, so partial support is visible.

## Optional xAI explanations and personal keys

Click **Explain with Grok** to send the parsed model to xAI using its Responses API, directly over HTTPS with no AI SDK dependency. The default model is `grok-4.7`; a server operator can override it with `XAI_MODEL`.

Users can enter an **xAI API key** in the masked Bring your own key field. Personal keys take precedence over the optional server `XAI_API_KEY`. Keys live only in React page memory, disappear on refresh/clear, and are sent only when Explain is clicked. They pass through the SchemaMind server to `https://api.x.ai/v1/responses`; this is not a browser-to-provider connection. The app does not persist or log them, put them in URLs, or include them in exports. Responses use `Cache-Control: no-store`; provider requests set `store: false`. Operators must keep request-body logging disabled in any external proxy/APM. Usage is billed to the supplied key.

No key is needed for imports, diagrams, exports, or builds. Missing/invalid keys, quota limits, incomplete responses and timeouts leave those features usable. Gemini and the previous gateway configuration are no longer used. This integration provides text explanations; speech generation is not included yet.

A public operator exposing a shared server key must supply access and usage controls appropriate to their deployment. BYOK works without configuring a shared key. Never commit keys or paste them into source schemas.

## Verification

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit tests cover all importers, incorrect/ambiguous formats, compound key pairing, forward/self references, Prisma targets, document nesting, unsupported warnings, exports and file discovery. Browser tests exercise the production build, browser workers, retained API validation, all sample inputs, file upload, dragging, details, downloads, AI absence, errors and mobile layout. Browser tests expect no xAI API key and start a local production server on port 3100.

## Add an importer

Implement `(text: string) => Schema` in `lib/importers`, register it in `index.ts`, and add its format, sample and support limits in `catalog.ts`. Preserve keys as groups, reference pairs as arrays, and document fields as a tree. Emit warnings for every unsupported category; never silently guess links or claim validation. Add regression fixtures before expanding the support matrix.

## Revival decisions

Started from `main` at `260ee6e`, with a clean checkout. Reviewed PR #4 (security update to another canary) and PR #5 (frontend extraction retaining the wrong stream protocol). Neither was merged. Stable Next.js/React replace old canary/RC versions; the unused mixed AI SDKs and fake canned insights were removed. npm's committed lockfile is now authoritative. No deployment/DNS/access changes are bundled here.

## UI preview

The interface uses an original SchemaMind design, not the Cassava design skill. Desktop and mobile captures from the production-browser checks:

![SchemaMind desktop workspace](docs/workspace-desktop.png)

[Mobile workspace screenshot](docs/workspace-mobile.png)

PostgreSQL scripts are split at statement boundaries, respecting quoted strings, dollar-quoted function bodies and nested comments. Supported CREATE TABLE and CREATE INDEX statements are imported; triggers, functions and migration operations are skipped with warnings. Their behavior is not represented. Invalid table syntax still fails, as do unquoted SQL routine bodies (use a schema-only export or dollar-quoted functions).

AI providers: xAI, Gemini, OpenAI, Kimi (Moonshot global API), and Claude (Anthropic API). Choose a provider and optionally enter a model ID and personal API key. Switching providers clears the key. Keys remain in page memory only and are sent through this server only to the selected provider's fixed API endpoint when Explain is clicked; provider retention policies apply. Provider subscriptions are not API credentials. No automatic cross-provider fallback is used.

Optional deployment keys: `XAI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `MOONSHOT_API_KEY`, `ANTHROPIC_API_KEY`. Optional model overrides: `XAI_MODEL`, `GEMINI_MODEL`, `OPENAI_MODEL`, `KIMI_MODEL`, `ANTHROPIC_MODEL`. Redeploy after changing environment variables. Without a matching server key, that provider requires BYOK. Adapter tests use mocked provider responses; they do not verify live account access or spend API credits.

PostgreSQL `COPY FROM STDIN` data dumps are explicitly rejected. Use `pg_dump --schema-only`; data rows are never interpreted as schema definitions.

Schema text and selected format are automatically saved as a versioned local browser draft (up to 200 KB) and restored after refresh. Drafts are not cloud-synced. Clear draft removes the saved input; browser storage failures are shown without blocking imports. API keys are never included in drafts.

## Automatic schema review

After each successful import, local rules review declared primary keys, unique relationship targets, mixed nullability in composite foreign keys, and potential foreign-key index gaps. Findings link to table details and require no AI key or network request. Document schemas instead receive guidance about required top-level properties.

Index suggestions are checks, not proof of missing indexes: ordinary indexes and unsupported syntax may be omitted by importers. The review does not validate data, workloads, permissions, type compatibility or migration safety. Always read import notes; no findings does not mean the database is fully audited.

### PostgreSQL rule metadata

PostgreSQL imports retain column/table CHECK expressions, ON DELETE/ON UPDATE actions (default NO ACTION), and parsed CREATE INDEX definitions, including unique, expression and partial indexes. Table details and JSON exports expose these rules; Mermaid remains a structural ERD. Full, plain-column unique B-tree indexes contribute unique keys. Only non-partial B-tree indexes with matching leading columns satisfy the review’s index coverage check. Expressions and predicates are displayed, never evaluated. Unsupported index syntax warns instead of silently claiming coverage. Other importers retain their existing support limits. No SQL is executed.
