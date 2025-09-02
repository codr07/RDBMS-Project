/**
 * Table operations module for RDBMS Project
 * Handles creating, modifying, and managing tables
 */

import { getDatabases, saveDatabases, getSelectedDatabase } from './database.js';

/**
 * Initialize table operations
 */
export function initTableOperations() {
  // Initialize event listeners
  const createTableBtn = document.getElementById('create-table-btn');
  createTableBtn.addEventListener('click', createTable);
  
  // Listen for database selection events
  document.addEventListener('database-selected', (event) => {
    const selectedDb = event.detail;
    loadTables(selectedDb);
  });
  
  // Check if a database is already selected
  const selectedDb = getSelectedDatabase();
  if (selectedDb) {
    document.getElementById('create-table-btn').disabled = false;
    loadTables(selectedDb);
  }
}

/**
 * Load tables for the selected database
 * @param {Object} database - Selected database object
 */
function loadTables(database) {
  const tableList = document.getElementById('table-list');
  
  if (!database || database.tables.length === 0) {
    tableList.innerHTML = '<p class="empty-message">No tables available</p>';
    return;
  }
  
  // Clear the list
  tableList.innerHTML = '';
  
  // Create list items for each table
  database.tables.forEach(table => {
    const tableItem = document.createElement('div');
    tableItem.className = 'list-item';
    tableItem.innerHTML = `
      <div class="item-content">
        <span class="item-name">${table.name}</span>
        <span class="item-meta">${table.columns.length} columns, ${table.rows.length} rows</span>
      </div>
      <div class="item-actions">
        <button class="action-btn view-table" data-id="${table.id}">View</button>
        <button class="action-btn delete-table" data-id="${table.id}">Delete</button>
      </div>
    `;
    tableList.appendChild(tableItem);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.view-table').forEach(btn => {
    btn.addEventListener('click', (e) => viewTable(e.target.getAttribute('data-id')));
  });
  
  document.querySelectorAll('.delete-table').forEach(btn => {
    btn.addEventListener('click', (e) => deleteTable(e.target.getAttribute('data-id')));
  });
}

/**
 * Create a new table
 */
function createTable() {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) {
    alert('Please select a database first.');
    return;
  }
  
  const tableName = prompt('Enter table name:');
  if (!tableName) return;
  
  // Check if table with same name exists
  if (selectedDb.tables.some(table => table.name === tableName)) {
    alert('A table with this name already exists in this database!');
    return;
  }
  
  // Get column definitions
  const columnCount = parseInt(prompt('How many columns do you want to add?', '1'));
  if (isNaN(columnCount) || columnCount < 1) return;
  
  const columns = [];
  for (let i = 0; i < columnCount; i++) {
    const columnName = prompt(`Enter name for column ${i + 1}:`);
    if (!columnName) return;
    
    const columnType = prompt(`Enter data type for column ${columnName} (text, number, boolean):`, 'text');
    if (!['text', 'number', 'boolean'].includes(columnType.toLowerCase())) {
      alert('Invalid data type. Please use text, number, or boolean.');
      return;
    }
    
    const isPrimaryKey = i === 0 ? confirm(`Make ${columnName} the primary key?`) : false;
    
    columns.push({
      id: Date.now().toString() + i,
      name: columnName,
      type: columnType.toLowerCase(),
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
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  
  if (dbIndex !== -1) {
    databases[dbIndex].tables.push(newTable);
    saveDatabases(databases);
    
    // Reload the tables
    loadTables(databases[dbIndex]);
  }
}

/**
 * View table data
 * @param {string} tableId - Table ID
 */
function viewTable(tableId) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  
  // Create modal for viewing table
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${table.name}</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="table-actions">
          <button class="add-row-btn">Add Row</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${table.columns.map(col => `<th>${col.name} (${col.type})${col.isPrimaryKey ? ' 🔑' : ''}</th>`).join('')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${table.rows.length === 0 ? 
                '<tr><td colspan="' + (table.columns.length + 1) + '">No data available</td></tr>' : 
                table.rows.map(row => `
                  <tr data-id="${row.id}">
                    ${table.columns.map(col => `<td>${formatCellValue(row[col.id], col.type)}</td>`).join('')}
                    <td>
                      <button class="edit-row" data-id="${row.id}">Edit</button>
                      <button class="delete-row" data-id="${row.id}">Delete</button>
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('.close-modal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.querySelector('.add-row-btn').addEventListener('click', () => {
    addRow(tableId, modal);
  });
  
  modal.querySelectorAll('.edit-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editRow(tableId, e.target.getAttribute('data-id'), modal);
    });
  });
  
  modal.querySelectorAll('.delete-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteRow(tableId, e.target.getAttribute('data-id'), modal);
    });
  });
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

/**
 * Add a new row to a table
 * @param {string} tableId - Table ID
 * @param {HTMLElement} modal - Modal element
 */
function addRow(tableId, modal) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  
  const newRow = { id: Date.now().toString() };
  
  // Get values for each column
  for (const column of table.columns) {
    let value;
    
    switch (column.type) {
      case 'number':
        value = parseFloat(prompt(`Enter value for ${column.name}:`, '0'));
        if (isNaN(value)) value = 0;
        break;
      case 'boolean':
        value = confirm(`Set ${column.name} to true? Cancel for false.`);
        break;
      default:
        value = prompt(`Enter value for ${column.name}:`, '');
        break;
    }
    
    newRow[column.id] = value;
  }
  
  // Add row to table
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
  
  if (dbIndex !== -1 && tableIndex !== -1) {
    databases[dbIndex].tables[tableIndex].rows.push(newRow);
    saveDatabases(databases);
    
    // Refresh the table view
    document.body.removeChild(modal);
    viewTable(tableId);
  }
}

/**
 * Edit a row in a table
 * @param {string} tableId - Table ID
 * @param {string} rowId - Row ID
 * @param {HTMLElement} modal - Modal element
 */
function editRow(tableId, rowId, modal) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  
  const row = table.rows.find(r => r.id === rowId);
  if (!row) return;
  
  // Update values for each column
  for (const column of table.columns) {
    let value;
    const currentValue = row[column.id];
    
    switch (column.type) {
      case 'number':
        value = parseFloat(prompt(`Enter value for ${column.name}:`, currentValue || '0'));
        if (isNaN(value)) value = currentValue || 0;
        break;
      case 'boolean':
        value = confirm(`Set ${column.name} to true? Cancel for false.`);
        break;
      default:
        value = prompt(`Enter value for ${column.name}:`, currentValue || '');
        break;
    }
    
    row[column.id] = value;
  }
  
  // Update row in table
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
  
  if (dbIndex !== -1 && tableIndex !== -1) {
    const rowIndex = databases[dbIndex].tables[tableIndex].rows.findIndex(r => r.id === rowId);
    if (rowIndex !== -1) {
      databases[dbIndex].tables[tableIndex].rows[rowIndex] = row;
      saveDatabases(databases);
      
      // Refresh the table view
      document.body.removeChild(modal);
      viewTable(tableId);
    }
  }
}

/**
 * Delete a row from a table
 * @param {string} tableId - Table ID
 * @param {string} rowId - Row ID
 * @param {HTMLElement} modal - Modal element
 */
function deleteRow(tableId, rowId, modal) {
  if (!confirm('Are you sure you want to delete this row? This action cannot be undone.')) {
    return;
  }
  
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  
  // Delete row from table
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
  
  if (dbIndex !== -1 && tableIndex !== -1) {
    databases[dbIndex].tables[tableIndex].rows = 
      databases[dbIndex].tables[tableIndex].rows.filter(r => r.id !== rowId);
    saveDatabases(databases);
    
    // Refresh the table view
    document.body.removeChild(modal);
    viewTable(tableId);
  }
}

/**
 * Delete a table
 * @param {string} tableId - Table ID
 */
function deleteTable(tableId) {
  if (!confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
    return;
  }
  
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  
  // Delete table from database
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  
  if (dbIndex !== -1) {
    databases[dbIndex].tables = databases[dbIndex].tables.filter(t => t.id !== tableId);
    saveDatabases(databases);
    
    // Reload the tables
    loadTables(databases[dbIndex]);
  }
}

// Add modal styles
const style = document.createElement('style');
style.textContent = `
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background-color: var(--background-dark);
    border-radius: 8px;
    width: 80%;
    max-width: 1000px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
  }
  
  .close-modal {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-light);
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    max-height: calc(80vh - 70px);
  }
  
  .table-actions {
    margin-bottom: 1rem;
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .data-table th,
  .data-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .data-table th {
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  .data-table tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .edit-row,
  .delete-row {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    margin-right: 0.5rem;
  }
  
  .edit-row {
    background-color: var(--secondary-color);
    color: white;
  }
  
  .delete-row {
    background-color: var(--danger-color);
    color: white;
  }
  
  .add-row-btn {
    background-color: var(--secondary-color);
    color: white;
  }
  
  @media (prefers-color-scheme: light) {
    .modal-content {
      background-color: var(--background-light);
    }
    
    .data-table th {
      background-color: #e2e8f0;
    }
    
    .data-table tr:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
  }
`;

document.head.appendChild(style);