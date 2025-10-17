# 🛢️ TestFlow Pro: Database Integration Guide

This guide explains how to configure and use **database queries in preProcess steps** in TestFlow Pro. Supported databases include **MySQL**, **ODBC-compatible systems**, and **DB2**.

---

## ✅ Supported Database Types

* **MySQL** (native support)
* **ODBC** (e.g., MS SQL Server, Oracle, DB2)
* **DB2** (via ODBC)

---

## 📦 .env File Configuration

Environment variables are used to store secure database credentials.
Each logical database connection should have a prefix like `DB_<NAME>_...`.

### 🔧 Example: `.env.qa`

```env
# MySQL DB (logical name: userDb)
DB_USERDB_TYPE=mysql
DB_USERDB_HOST=localhost
DB_USERDB_PORT=3306
DB_USERDB_USER=root
DB_USERDB_PASSWORD=secret
DB_USERDB_NAME=testflow

# ODBC DB (logical name: auditDb)
DB_AUDITDB_TYPE=odbc
DB_AUDITDB_CONNSTRING=DSN=AuditDSN

# DB2 via ODBC (logical name: customerDb)
DB_CUSTOMERDB_TYPE=db2
DB_CUSTOMERDB_CONNSTRING=DSN=MyDB2DSN
```

> ✅ Use `.env.dev`, `.env.qa`, `.env.prod`, etc. based on your `ENV` setting.

---

## 🧩 PreProcessStep Format

```ts
interface PreProcessStep {
    function: string;
    args?: any[];
    var?: string;
    mapTo?: Record<string, string>;
    db?: string; // Logical DB name
}
```

---

## 🧪 Usage Examples

### ✅ 1. Single Column Result (using `var`)

```json
{
  "function": "dbQuery",
  "args": ["SELECT code FROM countries WHERE name = 'India'"],
  "db": "customerDb",
  "var": "countryCode"
}
```

Stores: `countryCode = 'IN'`

---

### ✅ 2. Multiple Columns (using `mapTo`)

```json
{
  "function": "dbQuery",
  "args": ["SELECT id, name FROM users WHERE status = 'active' LIMIT 1"],
  "db": "userDb",
  "mapTo": {
    "userId": "id",
    "userName": "name"
  }
}
```

Stores:

* `userId = 123`
* `userName = 'afsar_ali'`

---

### ✅ 3. Dynamic Args Using Variable Injection

TestFlow Pro supports using `{{variable}}` placeholders in `args`, which are automatically replaced using `injectVariables`.

```json
{
  "function": "dbQuery",
  "args": ["SELECT email FROM users WHERE id = {{adminId}}"],
  "db": "userDb",
  "var": "adminEmail"
}
```

If `adminId` was set to `42` earlier, the final query becomes:

```sql
SELECT email FROM users WHERE id = 42
```

---

## 🧠 Notes & Best Practices

* Only the **first row** of the result set is used.
* For ODBC and DB2, make sure proper DSNs are defined in your system.
* `mapTo` is useful when you want to rename or selectively store fields.
* `var` is simpler when you need just one field (like an ID or name).
* If neither `mapTo` nor `var` is specified, the entire first row is stored under the function name.
* DB connections are initialized **lazily** — only when `dbQuery` is used.
* Variable placeholders like `{{userId}}` in `args` are supported and resolved automatically.

---

## 🛠️ Example Combined PreProcess

```json
[
  {
    "function": "faker.email",
    "var": "userEmail"
  },
  {
    "function": "encrypt",
    "args": ["P@ssw0rd123"],
    "var": "encryptedPwd"
  },
  {
    "function": "dbQuery",
    "args": ["SELECT id, email FROM users WHERE id = 1"],
    "db": "userDb",
    "mapTo": {
      "userId": "id",
      "userEmailFromDb": "email"
    }
  },
  {
    "function": "dbQuery",
    "args": ["SELECT email FROM users WHERE id = {{userId}}"],
    "db": "userDb",
    "var": "reFetchedEmail"
  }
]
```

---

## 🧰 Troubleshooting

| Issue                     | Possible Fix                                               |
| ------------------------- | ---------------------------------------------------------- |
| DB config not found       | Ensure correct `DB_<NAME>_TYPE` is set in your `.env` file |
| ODBC errors or connection | Check DSN config and connection string syntax              |
| Empty result              | Verify your query and ensure it returns at least one row   |
| Missing fields in mapTo   | Double-check column names in query match keys in `mapTo`   |
| Placeholder not replaced  | Ensure the variable used in `{{var}}` was set beforehand   |

---

For further customization or plugin-based DB support, reach out or contribute to the project!
