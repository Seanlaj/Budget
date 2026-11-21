-- Dates are ISO (YYYY-MM-DD). Bank rows removed by the user are kept as Excluded so syncs don't re-add them.
CREATE TABLE Income (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Date TEXT NOT NULL,
  Amount REAL NOT NULL,
  Source TEXT NOT NULL,
  Origin TEXT NOT NULL DEFAULT 'manual',
  PlaidTransactionId TEXT UNIQUE,
  AccountId TEXT,
  Pending INTEGER NOT NULL DEFAULT 0,
  Excluded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IncomeDate ON Income (Date);

CREATE TABLE Settings (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL
);
