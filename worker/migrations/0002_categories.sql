CREATE TABLE IF NOT EXISTS Categories (
  Name TEXT PRIMARY KEY,
  MonthlyBudget REAL NOT NULL DEFAULT 0,
  SortOrder INTEGER NOT NULL DEFAULT 0,
  Active INTEGER NOT NULL DEFAULT 1,
  PlaidMatch TEXT
);

INSERT OR IGNORE INTO Categories (Name, MonthlyBudget, SortOrder) VALUES
  ('Car Maintenance', 50, 1),
  ('Clothes', 100, 2),
  ('Costco', 220, 3),
  ('Eating Out', 120, 4),
  ('Entertainment', 100, 5),
  ('Gas', 175, 6),
  ('Gifts', 75, 7),
  ('Giving', 20, 8),
  ('Groceries', 1100, 9),
  ('Healthcare', 200, 10),
  ('Miscellaneous Needs', 300, 11),
  ('Non-Essentials (Wants)', 150, 12);

ALTER TABLE Expenses ADD COLUMN PlaidCategory TEXT;
