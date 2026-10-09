# FactoryOS

Manufacturing management for small and medium factories in Pakistan.

V1 is not a full ERP. It covers products, inventory, suppliers, customers, purchase orders, sales orders, bills of materials, production orders, basic production costing, users, and company tenancy.

This repository currently contains the foundation: the Nuxt application, the PostgreSQL schema, integrity rules, demo seed data, and tests for the stock, costing, and permission rules. Sign-in and the working modules come next, in this order:

1. Authentication
2. Company and users
3. Products
4. Warehouses
5. Inventory
6. Suppliers
7. Customers
8. Purchases
9. Bill of materials
10. Production
11. Sales
12. Dashboard
13. Reports
14. Audit log screens

## Technology stack

- Nuxt 4, Vue 3, and TypeScript
- Nuxt UI and Tailwind CSS
- Nuxt server routes on Nitro, with Zod validation
- PostgreSQL and Prisma ORM
- Vitest for business-rule tests

Redis and object storage are reserved in the environment file. They are not used in V1.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL 16 or newer, or Docker

## Installation

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `AUTH_SECRET` to a long random value before any shared or production deployment. The value in a local `.env` is for development only.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret used to sign sessions |
| `APP_URL` | Public application URL |

`.env` is gitignored. Do not commit database passwords or `AUTH_SECRET`.

`REDIS_URL` and the `S3_*` variables are listed in `.env.example` for later. Leave them unset.

## Database setup

Docker publishes Postgres on port **5433** so it does not collide with a PostgreSQL install already using 5432.

```bash
docker compose up -d
npm run db:deploy
npm run db:seed
```

The Compose database user, password, and database name are all `factoryos`.

Without Docker, create an empty database and put its connection string in `DATABASE_URL`, then run the same migrate and seed commands.

`npm run db:migrate` creates a new migration during development. `npm run db:reset` drops the database, reapplies migrations, and seeds it. Do not run reset against a database you need to keep.

## Demo credentials

Company: **Demo Manufacturing Co.**

Password for every demo user: `Demo@12345`

| Email | Role |
| --- | --- |
| owner@demo.com | Owner |
| admin@demo.com | Admin |
| production@demo.com | Production manager |
| store@demo.com | Store keeper |
| sales@demo.com | Sales |
| accountant@demo.com | Accountant |

The seed includes categories, three warehouses, raw materials, a 500ml bottle and its bill of materials, a received purchase, a confirmed purchase, a completed production order, a planned production order, a delivered sale with a partial payment, and a confirmed sale. Plastic Granules and Blue Masterbatch are below their minimum stock.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`GET /api/health` returns a JSON status and checks that the database answers.

## Testing

```bash
npm test
npm run lint
npm run typecheck
```

Unit tests cover material requirements, wastage, moving-average cost, negative stock, production cost, and the role matrix. Database tests cover company-scoped SKUs, cross-company stock, negative balances, and the rule that a raw material cannot own a bill of materials. Those database tests run only when `DATABASE_URL` is set.

## Production build

```bash
npm run build
npm run preview
```

On a server, set the environment variables, run `npm run db:deploy`, then start the Nuxt output with Node. Run `npm run db:seed` only on a new demo or staging database.

The app process does not need Docker. Docker is only a convenient way to run PostgreSQL.

## Architecture

```text
app/                  Vue pages, layouts, and components
server/api/           HTTP routes
server/services/      Business operations, added with each module
server/database/      Prisma client
server/utils/         Response and error helpers
shared/auth/          Role permissions
shared/domain/        Stock, BOM, and costing calculations
shared/validation/    Zod schemas shared by the client and server
shared/types/         API response types
prisma/schema.prisma  Database models
prisma/migrations/    Schema and database integrity rules
prisma/seed.ts        Demo company
```

API modules will live under `server/api/` by feature: `auth`, `products`, `inventory`, `suppliers`, `customers`, `purchases`, `sales`, `bom`, `production`, and `dashboard`.

A request is authenticated, limited to the signed-in company, checked against the role matrix, validated with Zod, and then handled by a service. The browser never filters tenant data on its own.

### Tenancy

A user belongs to one company in V1. `companyId` is taken from the session on the server. Clients cannot choose a company by sending an id.

Uniqueness is company-scoped. SKU, category name, warehouse name, and document numbers can repeat in another company.

### Stock

`StockMovement` is the ledger. Quantity is positive when stock increases and negative when it decreases. `StockBalance` stores the current quantity and moving-average cost for one product in one warehouse. Both rows change in the same database transaction. The balance cannot go below zero.

V1 bills of materials are single level. Producing a finished good consumes its direct components. It does not automatically manufacture those components first.

### Production warehouses

A production order stores `materialWarehouseId` and `outputWarehouseId`. A factory that keeps raw materials and finished goods apart would record the wrong stock if an order had only one warehouse. The two can still be the same warehouse.

### Money and quantities

Money and quantities are PostgreSQL `numeric(18,4)`, not floating point. Costs are rounded half-up to four decimal places. Production cost is material cost plus manual labour cost plus other cost. Unit cost is that total divided by the produced quantity.

### Roles

Permissions live in `shared/auth/permissions.ts`. The owner can do everything. The admin can do everything except company ownership changes. The storekeeper can receive purchases and adjust stock, and cannot record payments. Sales cannot create purchases. The accountant can record payments and cannot run production.

### Authentication design

Sessions will be random tokens stored as hashes in `Session`, sent in an httpOnly cookie. Passwords are bcrypt hashes. Reset tokens are stored only as hashes. That work is the next module. The tables are already in the schema.

## Business rules enforced in the database

- Stock balances cannot be negative.
- A stock movement cannot be edited or deleted. Corrections are new movements.
- Movement direction has to match the movement type.
- A product SKU is unique per company.
- Only one active BOM version exists per product.
- A BOM can belong only to a finished or semi-finished product, and a product cannot be a component of itself.
- Related records must belong to the same company. A purchase line cannot use another company's product.
- Received purchase orders and delivered sales orders cannot be deleted, and their status cannot be reopened.
- A completed production order cannot be edited or deleted.

## Data integrity risks

These still depend on the service layer once each module is built:

- `StockBalance` can drift from the movement ledger if a future feature updates one without the other. One stock service has to own both writes, and it has to lock the balance row so two production completions cannot oversell the same material.
- `referenceType` and `referenceId` on a movement are not foreign keys, because one ledger points at receipts, deliveries, production, and transfers. The stock service has to write a real document id.
- Document numbers have to be taken from `NumberSequence` inside the same transaction. The unique constraint stops duplicates, but the sequence table stops gaps and races.
- Average cost is only as good as the receipt and production unit cost passed into the stock service.
- Deactivate products that already have history. The foreign keys already block a hard delete.
- V1 does not explode a multi-level BOM. A semi-finished component is consumed as itself.

## Not in V1

Accounting, payroll, HR, FBR, e-invoicing, WhatsApp, SMS, CRM, barcode hardware, forecasting, multi-currency accounting, and a separate mobile app are out of scope.
