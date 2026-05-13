// Splits a comma-separated expression list respecting nested parentheses.
function splitTopLevel(str) {
  const parts = [];
  let depth = 0, current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Given a single SELECT expression, return the output column name.
function resolveColumnName(expr) {
  // AS alias (quoted or plain)
  const asMatch = expr.match(/\bAS\s+["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?\s*$/i);
  if (asMatch) return asMatch[1];

  // Plain identifier or table.column — take the last identifier token
  const plain = expr.trim().replace(/["'`]/g, '');
  const lastIdent = plain.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
  // Skip things like SELECT 1, SELECT 'literal', or pure function calls with no alias
  if (!lastIdent) return null;
  // If it ends with ) it's an unailiased function — return null (user should alias it)
  if (expr.trim().endsWith(')')) return null;
  return lastIdent[1];
}

// Extract the first real table name from a FROM clause fragment.
function extractFromTable(fromClause) {
  if (!fromClause) return null;
  // Strip sub-queries
  const stripped = fromClause.trim().replace(/^\([\s\S]+\)/, '').trim();
  const match = stripped.match(/^["'`]?([a-zA-Z_][a-zA-Z0-9_.]*)["'`]?/);
  return match ? match[1].split('.').pop() : null;
}

/**
 * Parse a SQL SELECT statement and return:
 *   { columns: string[], tableName: string|null }
 *
 * Handles:
 *   - Column aliases (AS)
 *   - Table-qualified columns (t.col → col)
 *   - Expressions with aliases (func(x) AS alias)
 *   - Leading WITH / CTE (stripped before parsing)
 *   - SELECT *  → columns = []
 */
export function parseSqlSelect(sql) {
  // Strip line comments and block comments
  let clean = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading WITH ... (CTEs) — find the SELECT that follows the last CTE closing paren
  // Simple heuristic: remove WITH <name> AS (...) blocks
  clean = clean.replace(/^WITH\s+/i, 'WITH ');
  let withStripped = clean;
  if (/^WITH\s/i.test(clean)) {
    // Walk forward past all CTE definitions to find the final SELECT
    let depth = 0, i = 0, inCte = false;
    for (; i < clean.length; i++) {
      if (clean[i] === '(') { depth++; inCte = true; }
      else if (clean[i] === ')') {
        depth--;
        if (depth === 0 && inCte) {
          // Skip optional comma to next CTE or arrive at SELECT
          let j = i + 1;
          while (j < clean.length && /[\s,]/.test(clean[j])) j++;
          if (/^SELECT\b/i.test(clean.slice(j))) {
            withStripped = clean.slice(j);
            break;
          }
        }
      }
    }
  }
  clean = withStripped;

  // Must start with SELECT
  if (!/^SELECT\b/i.test(clean)) return { columns: [], tableName: null };

  // Remove SELECT keyword
  const afterSelect = clean.slice(6).trim();

  // Remove leading DISTINCT / ALL
  const body = afterSelect.replace(/^(DISTINCT|ALL)\s+/i, '');

  // Find WHERE FROM JOIN GROUP HAVING ORDER LIMIT UNION — anything that ends the column list
  // Matches only at the start of the remaining slice, with word boundary after keyword.
  const endKeywords = /^(?:FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT\s|UNION\b)/i;

  // Walk body to find end of SELECT list (respecting parens)
  let depth = 0, endIdx = body.length;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') { depth++; continue; }
    if (body[i] === ')') { depth--; continue; }
    // Only test at word boundary starts
    if (depth === 0 && (i === 0 || !/[a-zA-Z0-9_]/.test(body[i - 1])) && endKeywords.test(body.slice(i))) {
      endIdx = i;
      break;
    }
  }

  const selectList = body.slice(0, endIdx).trim();
  const rest = body.slice(endIdx).trim();

  // Extract FROM table name
  const fromMatch = rest.match(/^FROM\s+([\s\S]+?)(?:\s+(?:WHERE|JOIN|GROUP|HAVING|ORDER|LIMIT|UNION)\b|$)/i);
  const tableName = extractFromTable(fromMatch ? fromMatch[1] : null);

  if (selectList === '*') return { columns: [], tableName };

  const rawCols = splitTopLevel(selectList);
  const columns = rawCols.map(resolveColumnName).filter(Boolean);

  return { columns, tableName };
}
