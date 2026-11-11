CREATE TABLE IF NOT EXISTS PlaidItems (
  ItemId TEXT PRIMARY KEY,
  InstitutionName TEXT,
  AccessToken TEXT NOT NULL,
  Cursor TEXT,
  Status TEXT NOT NULL DEFAULT 'ok',
  ImportFrom TEXT NOT NULL,
  LastSyncedAt TEXT,
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS PlaidAccounts (
  AccountId TEXT PRIMARY KEY,
  ItemId TEXT NOT NULL,
  Name TEXT,
  Mask TEXT,
  Type TEXT,
  Subtype TEXT
);

CREATE TABLE IF NOT EXISTS CategoryRules (
  MerchantKey TEXT PRIMARY KEY,
  Category TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE Expenses ADD COLUMN Source TEXT;
ALTER TABLE Expenses ADD COLUMN PlaidTransactionId TEXT;
ALTER TABLE Expenses ADD COLUMN AccountId TEXT;
ALTER TABLE Expenses ADD COLUMN NeedsReview INTEGER NOT NULL DEFAULT 0;
ALTER TABLE Expenses ADD COLUMN DuplicateOf INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_plaid_txn ON Expenses(PlaidTransactionId);
