/**
 * Query operations module for RDBMS Project
 * Handles SQL query parsing and execution
 */

import { getSelectedDatabase, getDatabases, saveDatabases } from './database.js';

// Simple snapshot stack for ROLLBACK support
const SNAPSHOT_KEY = 'rdbms_snapshots';

function pushSnapshot() {
  const databases = getDatabases();
  const stackJson = localStorage.getItem(SNAPSHOT_KEY);
  const stack = stackJson ? JSON.parse(stackJson) : [];
  stack.push(databases);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stack));
}

function popSnapshot() {
  const stackJson = localStorage.getItem(SNAPSHOT_KEY);
  const stack = stackJson ? JSON.parse(stackJson) : [];
  const last = stack.pop();
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stack));
  return last || null;
}

function clearSnapshots() {
  localStorage.removeItem(SNAPSHOT_KEY);
}

/**
 * Initialize query operations
 */
export function initQueryOperations() {
  // Initialize event listeners
  const executeQueryBtn = document.getElementById('execute-query-btn');
  executeQueryBtn.addEventListener('click', executeQuery);
  
  // Check if a database is already selected
  const selectedDb = getSelectedDatabase();
  if (selectedDb) {
    document.getElementById('execute-query-btn').disabled = false;
  }
}

/**
 * Execute SQL query
 */
function executeQuery() {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) {
    showQueryResult('Error: No database selected', true);
    return;
  }
  
  const queryText = document.getElementById('sql-query').value.trim();
  if (!queryText) {
    showQueryResult('Error: Query is empty', true);
    return;
  }
  
  try {
    // Parse and execute the query
    const result = parseAndExecuteQuery(queryText, selectedDb);
    showQueryResult(result);
  } catch (error) {
    showQueryResult(`Error: ${error.message}`, true);
  }
}

/**
 * Parse and execute SQL query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function parseAndExecuteQuery(query, database) {
  // Convert to uppercase for easier parsing
  const sanitized = query.trim().replace(/;\s*$/, '');
  const upperQuery = sanitized.toUpperCase();
  
  // Determine query type
  if (upperQuery.startsWith('SELECT')) {
    return executeSelectQuery(sanitized, database);
  } else if (upperQuery.startsWith('INSERT')) {
    return executeInsertQuery(sanitized, database);
  } else if (upperQuery.startsWith('UPDATE')) {
    return executeUpdateQuery(sanitized, database);
  } else if (upperQuery.startsWith('DELETE')) {
    return executeDeleteQuery(sanitized, database);
  } else if (upperQuery.startsWith('CREATE TABLE')) {
    return executeCreateTableQuery(sanitized, database);
  } else if (upperQuery.startsWith('CREATE DATABASE')) {
    return executeCreateDatabaseQuery(sanitized);
  } else if (upperQuery.startsWith('DROP DATABASE')) {
    return executeDropDatabaseQuery(sanitized);
  } else if (upperQuery.startsWith('USE')) {
    return executeUseDatabaseQuery(sanitized);
  } else if (upperQuery.startsWith('DROP TABLE')) {
    return executeDropTableQuery(sanitized, database);
  } else if (upperQuery.startsWith('GRANT')) {
    return executeGrantQuery(sanitized, database);
  } else if (upperQuery.startsWith('REVOKE')) {
    return executeRevokeQuery(sanitized, database);
  } else if (upperQuery.startsWith('BEGIN')) {
    return executeBeginQuery();
  } else if (upperQuery.startsWith('COMMIT')) {
    return executeCommitQuery();
  } else if (upperQuery.startsWith('ROLLBACK')) {
    return executeRollbackQuery();
  } else {
    throw new Error('Unsupported query type. Supported types: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE');
  }
}

/**
 * Execute SELECT query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function executeSelectQuery(query, database) {
  // Basic SELECT parsing
  // Format: SELECT column1, column2 FROM table WHERE condition
  
  const regex = /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid SELECT query format');
  }
  
  const columns = match[1].split(',').map(col => col.trim());
  const tableName = match[2].trim();
  const whereClause = match[3] ? match[3].trim() : null;
  
  // Find the table
  const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table '${tableName}' not found`);
  }
  
  // Get all columns if * is specified
  const selectedColumns = columns[0] === '*' ? 
    table.columns.map(col => col.name) : 
    columns;
  
  // Validate columns
  const tableColumnNames = table.columns.map(col => col.name.toLowerCase());
  for (const col of selectedColumns) {
    if (col !== '*' && !tableColumnNames.includes(col.toLowerCase())) {
      throw new Error(`Column '${col}' not found in table '${tableName}'`);
    }
  }
  
  // Filter rows based on WHERE clause
  let filteredRows = table.rows;
  if (whereClause) {
    filteredRows = filterRowsByCondition(table, filteredRows, whereClause);
  }
  
  // Project selected columns
  const result = {
    columns: selectedColumns === '*' ? table.columns : 
      table.columns.filter(col => selectedColumns.includes(col.name)),
    rows: filteredRows,
    message: `${filteredRows.length} row(s) returned`
  };
  
  return result;
}

/**
 * Execute INSERT query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function executeInsertQuery(query, database) {
  pushSnapshot();
  // Basic INSERT parsing
  // Format: INSERT INTO table (column1, column2) VALUES (value1, value2)
  
  const regex = /INSERT\s+INTO\s+(\w+)\s*\((.+?)\)\s*VALUES\s*\((.+?)\)/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid INSERT query format');
  }
  
  const tableName = match[1].trim();
  const columns = match[2].split(',').map(col => col.trim());
  const values = match[3].split(',').map(val => {
    const trimmed = val.trim();
    // Remove quotes from string values
    if ((trimmed.startsWith('\'') && trimmed.endsWith('\'')) || 
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    // Convert to appropriate type
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    if (!isNaN(trimmed)) return Number(trimmed);
    return trimmed;
  });
  
  // Find the table
  const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table '${tableName}' not found`);
  }
  
  // Validate columns
  const tableColumns = table.columns;
  for (const col of columns) {
    if (!tableColumns.some(c => c.name.toLowerCase() === col.toLowerCase())) {
      throw new Error(`Column '${col}' not found in table '${tableName}'`);
    }
  }
  
  // Create new row
  const newRow = { id: Date.now().toString() };
  
  // Set values for specified columns
  for (let i = 0; i < columns.length; i++) {
    const columnName = columns[i];
    const column = tableColumns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
    newRow[column.id] = values[i];
  }
  
  // Update database
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === table.id);
  
  databases[dbIndex].tables[tableIndex].rows.push(newRow);
  saveDatabases(databases);
  
  return {
    message: '1 row inserted successfully'
  };
}

/**
 * Execute UPDATE query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function executeUpdateQuery(query, database) {
  pushSnapshot();
  // Basic UPDATE parsing
  // Format: UPDATE table SET column1 = value1, column2 = value2 WHERE condition
  
  const regex = /UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid UPDATE query format');
  }
  
  const tableName = match[1].trim();
  const setClause = match[2].trim();
  const whereClause = match[3] ? match[3].trim() : null;
  
  // Find the table
  const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table '${tableName}' not found`);
  }
  
  // Parse SET clause
  const setExpressions = setClause.split(',').map(expr => {
    const [columnName, valueStr] = expr.split('=').map(part => part.trim());
    let value = valueStr;
    
    // Remove quotes from string values
    if ((value.startsWith('\'') && value.endsWith('\'')) || 
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.substring(1, value.length - 1);
    }
    // Convert to appropriate type
    else if (value.toLowerCase() === 'true') value = true;
    else if (value.toLowerCase() === 'false') value = false;
    else if (!isNaN(value)) value = Number(value);
    
    return { columnName, value };
  });
  
  // Validate columns
  for (const { columnName } of setExpressions) {
    if (!table.columns.some(c => c.name.toLowerCase() === columnName.toLowerCase())) {
      throw new Error(`Column '${columnName}' not found in table '${tableName}'`);
    }
  }
  
  // Filter rows based on WHERE clause
  let rowsToUpdate = table.rows;
  if (whereClause) {
    rowsToUpdate = filterRowsByCondition(table, rowsToUpdate, whereClause);
  }
  
  // Update rows
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === table.id);
  
  for (const row of rowsToUpdate) {
    for (const { columnName, value } of setExpressions) {
      const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
      const rowIndex = databases[dbIndex].tables[tableIndex].rows.findIndex(r => r.id === row.id);
      if (rowIndex !== -1) {
        databases[dbIndex].tables[tableIndex].rows[rowIndex][column.id] = value;
      }
    }
  }
  
  saveDatabases(databases);
  
  return {
    message: `${rowsToUpdate.length} row(s) updated successfully`
  };
}

/**
 * Execute DELETE query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function executeDeleteQuery(query, database) {
  pushSnapshot();
  // Basic DELETE parsing
  // Format: DELETE FROM table WHERE condition
  
  const regex = /DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid DELETE query format');
  }
  
  const tableName = match[1].trim();
  const whereClause = match[2] ? match[2].trim() : null;
  
  // Find the table
  const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table '${tableName}' not found`);
  }
  
  // Filter rows based on WHERE clause
  let rowsToDelete = table.rows;
  if (whereClause) {
    rowsToDelete = filterRowsByCondition(table, rowsToDelete, whereClause);
  }
  
  // Delete rows
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === table.id);
  
  const rowIds = rowsToDelete.map(row => row.id);
  databases[dbIndex].tables[tableIndex].rows = 
    databases[dbIndex].tables[tableIndex].rows.filter(row => !rowIds.includes(row.id));
  
  saveDatabases(databases);
  
  return {
    message: `${rowsToDelete.length} row(s) deleted successfully`
  };
}

/**
 * Execute CREATE TABLE query
 * @param {string} query - SQL query
 * @param {Object} database - Selected database
 * @returns {Object} Query result
 */
function executeCreateTableQuery(query, database) {
  pushSnapshot();
  // CREATE TABLE parsing with SQL types and optional lengths/precision
  // Format: CREATE TABLE table (column1 TYPE[(len|p,s)] [PRIMARY KEY], ...)
  
  const regex = /CREATE\s+TABLE\s+(\w+)\s*\((.+)\)/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid CREATE TABLE query format');
  }
  
  const tableName = match[1].trim();
  // Split columns by commas that are not inside parentheses
  const defsRaw = match[2].trim();
  const columnDefs = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < defsRaw.length; i++) {
    const ch = defsRaw[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (buf.trim()) columnDefs.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) columnDefs.push(buf.trim());
  
  // Check if table already exists
  if (database.tables.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
    throw new Error(`Table '${tableName}' already exists`);
  }
  
  // Parse column definitions
  const columns = [];
  for (let i = 0; i < columnDefs.length; i++) {
    const colDef = columnDefs[i];
    const nameMatch = colDef.match(/^(\w+)/);
    if (!nameMatch) throw new Error(`Invalid column definition: ${colDef}`);
    const columnName = nameMatch[1];
    const typeMatch = colDef.replace(columnName, '').trim();
    if (!typeMatch) throw new Error(`Missing type for column: ${columnName}`);
    const parsed = parseSqlType(typeMatch);
    if (!parsed) throw new Error(`Invalid type for column ${columnName}: ${typeMatch}`);
    const isPrimaryKey = colDef.toUpperCase().includes('PRIMARY KEY');
    columns.push({
      id: Date.now().toString() + i,
      name: columnName,
      type: parsed.baseType,
      originalType: parsed.original,
      length: parsed.length ?? null,
      precision: parsed.precision ?? null,
      scale: parsed.scale ?? null,
      isPrimaryKey
    });
  }
  
  // Create new table
  const newTable = {
    id: Date.now().toString(),
    name: tableName,
    columns,
    rows: [],
    createdAt: new Date().toISOString()
  };
  
  // Add to database and save
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  
  databases[dbIndex].tables.push(newTable);
  saveDatabases(databases);
  
  // Trigger table list refresh
  const event = new CustomEvent('database-selected', { detail: databases[dbIndex] });
  document.dispatchEvent(event);
  
  return {
    message: `Table '${tableName}' created successfully`
  };
}

/**
 * Execute CREATE DATABASE query
 */
function executeCreateDatabaseQuery(query) {
  const regex = /CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid CREATE DATABASE query. Usage: CREATE DATABASE [IF NOT EXISTS] dbname');
  const dbName = match[2];
  const databases = getDatabases();
  if (databases.some(db => db.name.toLowerCase() === dbName.toLowerCase())) {
    if (match[1]) return { message: `Database '${dbName}' already exists` };
    throw new Error(`Database '${dbName}' already exists`);
  }
  pushSnapshot();
  const newDb = { id: Date.now().toString(), name: dbName, tables: [], createdAt: new Date().toISOString(), meta: { permissions: [] } };
  databases.push(newDb);
  saveDatabases(databases);
  localStorage.setItem('selected_database', newDb.id);
  const event = new CustomEvent('database-selected', { detail: newDb });
  document.dispatchEvent(event);
  return { message: `Database '${dbName}' created` };
}

/**
 * Execute DROP DATABASE query
 */
function executeDropDatabaseQuery(query) {
  const regex = /DROP\s+DATABASE\s+(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid DROP DATABASE query. Usage: DROP DATABASE dbname');
  const dbName = match[1];
  const databases = getDatabases();
  const db = databases.find(d => d.name.toLowerCase() === dbName.toLowerCase());
  if (!db) throw new Error(`Database '${dbName}' not found`);
  pushSnapshot();
  const filtered = databases.filter(d => d.id !== db.id);
  saveDatabases(filtered);
  const selectedId = localStorage.getItem('selected_database');
  if (selectedId === db.id) {
    localStorage.removeItem('selected_database');
    const event = new CustomEvent('database-selected', { detail: null });
    document.dispatchEvent(event);
  }
  return { message: `Database '${dbName}' dropped` };
}

/**
 * Execute USE dbname query
 */
function executeUseDatabaseQuery(query) {
  const regex = /USE\s+(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid USE query. Usage: USE dbname');
  const dbName = match[1];
  const databases = getDatabases();
  const db = databases.find(d => d.name.toLowerCase() === dbName.toLowerCase());
  if (!db) throw new Error(`Database '${dbName}' not found`);
  localStorage.setItem('selected_database', db.id);
  const event = new CustomEvent('database-selected', { detail: db });
  document.dispatchEvent(event);
  return { message: `Using database '${dbName}'` };
}

/**
 * Execute DROP TABLE query
 */
function executeDropTableQuery(query, database) {
  const regex = /DROP\s+TABLE\s+(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid DROP TABLE query. Usage: DROP TABLE tableName');
  const tableName = match[1];
  const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) throw new Error(`Table '${tableName}' not found`);
  pushSnapshot();
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  databases[dbIndex].tables = databases[dbIndex].tables.filter(t => t.id !== table.id);
  saveDatabases(databases);
  const event = new CustomEvent('database-selected', { detail: databases[dbIndex] });
  document.dispatchEvent(event);
  return { message: `Table '${tableName}' dropped` };
}

/**
 * Execute GRANT query - stores permissions metadata (no enforcement layer here)
 */
function executeGrantQuery(query, database) {
  // GRANT <privilege> ON <table|database> <name> TO <user>
  const regex = /GRANT\s+(\w+)\s+ON\s+(TABLE|DATABASE)\s+(\w+)\s+TO\s+(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid GRANT query. Usage: GRANT <privilege> ON TABLE|DATABASE <name> TO <user>');
  const [, privilege, scopeType, name, user] = match;
  pushSnapshot();
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  if (!databases[dbIndex].meta) databases[dbIndex].meta = { permissions: [] };
  databases[dbIndex].meta.permissions.push({ action: 'GRANT', privilege, scopeType: scopeType.toUpperCase(), name, user, at: new Date().toISOString() });
  saveDatabases(databases);
  return { message: `Granted ${privilege.toUpperCase()} on ${scopeType.toUpperCase()} ${name} to ${user}` };
}

/**
 * Execute REVOKE query - stores permissions metadata (no enforcement layer here)
 */
function executeRevokeQuery(query, database) {
  // REVOKE <privilege> ON <table|database> <name> FROM <user>
  const regex = /REVOKE\s+(\w+)\s+ON\s+(TABLE|DATABASE)\s+(\w+)\s+FROM\s+(\w+)/i;
  const match = query.match(regex);
  if (!match) throw new Error('Invalid REVOKE query. Usage: REVOKE <privilege> ON TABLE|DATABASE <name> FROM <user>');
  const [, privilege, scopeType, name, user] = match;
  pushSnapshot();
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === database.id);
  if (!databases[dbIndex].meta) databases[dbIndex].meta = { permissions: [] };
  databases[dbIndex].meta.permissions.push({ action: 'REVOKE', privilege, scopeType: scopeType.toUpperCase(), name, user, at: new Date().toISOString() });
  saveDatabases(databases);
  return { message: `Revoked ${privilege.toUpperCase()} on ${scopeType.toUpperCase()} ${name} from ${user}` };
}

/**
 * Execute BEGIN (start transaction) - snapshot
 */
function executeBeginQuery() {
  pushSnapshot();
  return { message: 'Transaction started' };
}

/**
 * Execute COMMIT - clear snapshots
 */
function executeCommitQuery() {
  clearSnapshots();
  return { message: 'Transaction committed' };
}

/**
 * Execute ROLLBACK - restore last snapshot
 */
function executeRollbackQuery() {
  const snapshot = popSnapshot();
  if (!snapshot) {
    return { message: 'Nothing to rollback' };
  }
  saveDatabases(snapshot);
  // If selected database no longer exists, clear selection
  const selectedId = localStorage.getItem('selected_database');
  if (selectedId) {
    const refreshed = getDatabases();
    if (!refreshed.some(db => db.id === selectedId)) {
      localStorage.removeItem('selected_database');
      const event = new CustomEvent('database-selected', { detail: null });
      document.dispatchEvent(event);
    } else {
      const db = refreshed.find(d => d.id === selectedId);
      const event = new CustomEvent('database-selected', { detail: db });
      document.dispatchEvent(event);
    }
  }
  return { message: 'Rolled back to previous state' };
}

// Lightweight SQL type parser for CREATE TABLE
function parseSqlType(typeStr) {
  const raw = typeStr.trim();
  const upper = raw.toUpperCase();
  const tokenMatch = upper.match(/^(\w+)(\s*\(([^)]+)\))?/);
  if (!tokenMatch) return null;
  const baseToken = tokenMatch[1];
  const args = tokenMatch[3] ? tokenMatch[3].split(',').map(s => s.trim()) : [];
  let length = null, precision = null, scale = null;
  if (args.length === 1) {
    const n = parseInt(args[0], 10); if (!isNaN(n)) length = n;
  } else if (args.length === 2) {
    const p = parseInt(args[0], 10); const s = parseInt(args[1], 10);
    if (!isNaN(p)) precision = p; if (!isNaN(s)) scale = s;
  }
  let baseType;
  if (["INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT"].includes(baseToken)) baseType = 'number';
  else if (["DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL"].includes(baseToken)) baseType = 'number';
  else if (["CHAR", "NCHAR", "VARCHAR", "NVARCHAR", "TEXT", "STRING"].includes(baseToken)) baseType = 'text';
  else if (["BOOL", "BOOLEAN"].includes(baseToken)) baseType = 'boolean';
  else if (baseToken === 'DATE') baseType = 'date';
  else if (["DATETIME", "TIMESTAMP"].includes(baseToken)) baseType = 'datetime';
  else baseType = 'text';
  return { original: raw, baseType, length, precision, scale };
}

/**
 * Filter rows by condition
 * @param {Object} table - Table object
 * @param {Array} rows - Rows to filter
 * @param {string} condition - WHERE condition
 * @returns {Array} Filtered rows
 */
function filterRowsByCondition(table, rows, condition) {
  // Very basic condition parsing
  // Only supports simple conditions like column = value, column > value, etc.
  
  // Handle basic operators
  const operatorRegex = /(\w+)\s*([=><]+)\s*(.+)/;
  const match = condition.match(operatorRegex);
  
  if (!match) {
    throw new Error(`Invalid condition: ${condition}`);
  }
  
  const columnName = match[1].trim();
  const operator = match[2].trim();
  let value = match[3].trim();
  
  // Find the column
  const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
  if (!column) {
    throw new Error(`Column '${columnName}' not found`);
  }
  
  // Remove quotes from string values
  if ((value.startsWith('\'') && value.endsWith('\'')) || 
      (value.startsWith('"') && value.endsWith('"'))) {
    value = value.substring(1, value.length - 1);
  }
  // Convert to appropriate type
  else if (value.toLowerCase() === 'true') value = true;
  else if (value.toLowerCase() === 'false') value = false;
  else if (!isNaN(value)) value = Number(value);
  
  // Filter rows based on condition
  return rows.filter(row => {
    const cellValue = row[column.id];
    
    switch (operator) {
      case '=':
        return cellValue == value;
      case '!=':
      case '<>':
        return cellValue != value;
      case '>':
        return cellValue > value;
      case '<':
        return cellValue < value;
      case '>=':
        return cellValue >= value;
      case '<=':
        return cellValue <= value;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  });
}

/**
 * Show query result in the UI
 * @param {Object|string} result - Query result or error message
 * @param {boolean} isError - Whether the result is an error
 */
function showQueryResult(result, isError = false) {
  const resultsContainer = document.getElementById('query-results');
  
  if (isError) {
    resultsContainer.innerHTML = `<div class="error-message">${result}</div>`;
    return;
  }
  
  if (result.message && !result.columns) {
    // Show success message for non-SELECT queries
    resultsContainer.innerHTML = `<div class="success-message">${result.message}</div>`;
    return;
  }
  
  // Show table for SELECT queries
  const table = document.createElement('table');
  table.className = 'data-table';
  
  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  result.columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column.name;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  if (result.rows.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = result.columns.length;
    emptyCell.textContent = 'No data available';
    emptyCell.className = 'empty-message';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    result.rows.forEach(row => {
      const tr = document.createElement('tr');
      
      result.columns.forEach(column => {
        const td = document.createElement('td');
        td.textContent = formatCellValue(row[column.id], column.type);
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
  }
  
  table.appendChild(tbody);
  
  // Show result count
  const resultInfo = document.createElement('div');
  resultInfo.className = 'result-info';
  resultInfo.textContent = result.message;
  
  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(table);
  resultsContainer.appendChild(resultInfo);
}

/**
 * Format cell value based on column type
 * @param {any} value - Cell value
 * @param {string} type - Column type
 * @returns {string} Formatted value
 */
function formatCellValue(value, type) {
  if (value === undefined || value === null) return '';
  
  switch (type) {
    case 'boolean':
      return value ? 'True' : 'False';
    case 'number':
      return isNaN(value) ? '0' : value.toString();
    default:
      return value.toString();
  }
}

// Add query result styles
const style = document.createElement('style');
style.textContent = `
  .error-message {
    color: var(--danger-color);
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
  }
  
  .success-message {
    color: var(--secondary-color);
    padding: 1rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
  }
  
  .result-info {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #888;
  }
`;

document.head.appendChild(style);