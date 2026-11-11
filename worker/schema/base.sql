-- Original Expenses table, before the numbered migrations. Only for creating a brand-new database:
-- npx wrangler d1 execute <db> --remote --file schema/base.sql, then apply migrations.
CREATE TABLE IF NOT EXISTS Expenses (
  Id INTEGER PRIMARY KEY,
  "Date" DATE,
  Amount INT,
  Store TEXT,
  Items TEXT,
  Category TEXT
);
