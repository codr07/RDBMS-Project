/**
 * Query operations module for RDBMS Project
 * Handles SQL query parsing and execution
 */

import { getSelectedDatabase, getDatabases, saveDatabases } from './database.js';

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
  const upperQuery = query.toUpperCase();
  
  // Determine query type
  if (upperQuery.startsWith('SELECT')) {
    return executeSelectQuery(query, database);
  } else if (upperQuery.startsWith('INSERT')) {
    return executeInsertQuery(query, database);
  } else if (upperQuery.startsWith('UPDATE')) {
    return executeUpdateQuery(query, database);
  } else if (upperQuery.startsWith('DELETE')) {
    return executeDeleteQuery(query, database);
  } else if (upperQuery.startsWith('CREATE TABLE')) {
    return executeCreateTableQuery(query, database);
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
  // Basic CREATE TABLE parsing
  // Format: CREATE TABLE table (column1 type1, column2 type2)
  
  const regex = /CREATE\s+TABLE\s+(\w+)\s*\((.+)\)/i;
  const match = query.match(regex);
  
  if (!match) {
    throw new Error('Invalid CREATE TABLE query format');
  }
  
  const tableName = match[1].trim();
  const columnDefs = match[2].split(',').map(col => col.trim());
  
  // Check if table already exists
  if (database.tables.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
    throw new Error(`Table '${tableName}' already exists`);
  }
  
  // Parse column definitions
  const columns = [];
  for (let i = 0; i < columnDefs.length; i++) {
    const colDef = columnDefs[i];
    const parts = colDef.split(/\s+/);
    
    if (parts.length < 2) {
      throw new Error(`Invalid column definition: ${colDef}`);
    }
    
    const columnName = parts[0];
    let columnType = parts[1].toLowerCase();
    
    // Map SQL types to our supported types
    if (['int', 'integer', 'decimal', 'float', 'double'].includes(columnType)) {
      columnType = 'number';
    } else if (['varchar', 'char', 'text', 'string'].includes(columnType)) {
      columnType = 'text';
    } else if (['bool', 'boolean'].includes(columnType)) {
      columnType = 'boolean';
    } else {
      columnType = 'text'; // Default to text for unsupported types
    }
    
    // Check for primary key
    const isPrimaryKey = colDef.toUpperCase().includes('PRIMARY KEY');
    
    columns.push({
      id: Date.now().toString() + i,
      name: columnName,
      type: columnType,
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