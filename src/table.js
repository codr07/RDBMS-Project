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
  createTableBtn.addEventListener('click', openCreateTableModal);
  
  // Import file handlers
  const importBtn = document.getElementById('import-file-btn');
  const importInput = document.getElementById('import-file-input');
  if (importBtn && importInput) {
    importInput.addEventListener('change', () => {
      importBtn.disabled = !importInput.files || importInput.files.length === 0 || !getSelectedDatabase();
    });
    importBtn.addEventListener('click', () => {
      if (!importInput.files || importInput.files.length === 0) return;
      handleImportFile(importInput.files[0]);
    });
  }
  
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

  // Allow other modules to open a table directly
  document.addEventListener('open-table', (e) => {
    const tableId = e.detail && e.detail.tableId;
    if (tableId) viewTable(tableId);
  });
}

// Parse SQL type strings like VARCHAR(50), CHAR(10), INT, INTEGER,
// DECIMAL(10,2), NUMERIC(8,3), DATE, DATETIME, BOOLEAN
function parseSqlType(original) {
  const raw = original.trim();
  const upper = raw.toUpperCase();
  const paren = upper.match(/^(\w+)\s*\(([^)]+)\)$/);
  let base = upper;
  let length = null;
  let precision = null;
  let scale = null;
  if (paren) {
    base = paren[1];
    const parts = paren[2].split(',').map(s => s.trim());
    if (parts.length === 1) {
      const n = parseInt(parts[0], 10);
      if (!isNaN(n)) length = n;
    } else if (parts.length === 2) {
      const p = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(p)) precision = p;
      if (!isNaN(s)) scale = s;
    }
  }
  // Map to normalized runtime base types
  let baseType;
  if (["INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT"].includes(base)) baseType = 'number';
  else if (["DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL"].includes(base)) baseType = 'number';
  else if (["CHAR", "NCHAR", "VARCHAR", "NVARCHAR", "TEXT", "STRING"].includes(base)) baseType = 'text';
  else if (["BOOL", "BOOLEAN"].includes(base)) baseType = 'boolean';
  else if (base === 'DATE') baseType = 'date';
  else if (["DATETIME", "TIMESTAMP"].includes(base)) baseType = 'datetime';
  else baseType = 'text';

  return { original: raw, baseType, length, precision, scale };
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
    
    const columnType = prompt(`Enter data type for column ${columnName} (e.g., VARCHAR(50), INT, DECIMAL(10,2), DATE, DATETIME, BOOLEAN):`, 'VARCHAR(255)');
    if (!columnType) return;
    const parsed = parseSqlType(columnType);
    if (!parsed) {
      alert('Invalid data type. Examples: VARCHAR(50), INT, DECIMAL(10,2), DATE, DATETIME, BOOLEAN');
      return;
    }
    
    const isPrimaryKey = i === 0 ? confirm(`Make ${columnName} the primary key?`) : false;
    
    columns.push({
      id: Date.now().toString() + i,
      name: columnName,
      type: parsed.baseType, // normalized base type for runtime formatting/sorting
      originalType: parsed.original, // preserve original SQL type string
      length: parsed.length ?? null, // for char types
      precision: parsed.precision ?? null, // for numeric
      scale: parsed.scale ?? null, // for numeric
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
export function viewTable(tableId) {
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
          <input class="table-search-input" type="text" placeholder="Search in table..." />
          <select class="table-filter-column">
            <option value="">Filter column...</option>
            ${table.columns.map(col => `<option value="${col.id}">${col.name}</option>`).join('')}
          </select>
          <input class="table-filter-value" type="text" placeholder="Filter value..." />
          <button class="apply-filter-btn">Apply</button>
          <button class="clear-filter-btn">Clear</button>
          <div style="flex:1"></div>
          <button class="rename-table-btn secondary-btn">Rename Table</button>
          <button class="manage-columns-btn secondary-btn">Manage Columns</button>
          <button class="analytics-btn secondary-btn">Analytics</button>
          <button class="export-btn secondary-btn">Export</button>
          <button class="duplicates-btn secondary-btn">Duplicates</button>
          <button class="add-row-btn">Add Row</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${table.columns.map(col => `<th data-col-id="${col.id}" class="sortable">${col.name} (${col.type})${col.isPrimaryKey ? ' 🔑' : ''}<span class="sort-indicator"></span></th>`).join('')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="${table.columns.length + 1}">No data available</td></tr>
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
  
  // Rename table
  modal.querySelector('.rename-table-btn').addEventListener('click', () => {
    openRenameTableModal(tableId, modal);
  });
  // Manage columns
  modal.querySelector('.manage-columns-btn').addEventListener('click', () => {
    openManageColumnsModal(tableId, modal);
  });
  // Export single table
  modal.querySelector('.export-btn').addEventListener('click', () => {
    const evt = new CustomEvent('open-export', { detail: { scope: 'table', tableId } });
    document.dispatchEvent(evt);
  });
  // Analytics
  modal.querySelector('.analytics-btn').addEventListener('click', () => {
    openAnalyticsModal(tableId);
  });
  // Manage duplicates
  modal.querySelector('.duplicates-btn').addEventListener('click', () => {
    openDuplicatesModal(tableId);
  });

  // State for sorting/filtering/searching
  let sortColumnId = '';
  let sortDirection = 'asc'; // 'asc' | 'desc'
  let searchTerm = '';
  let filterColumnId = '';
  let filterValue = '';

  const tbody = modal.querySelector('tbody');
  const searchInput = modal.querySelector('.table-search-input');
  const filterColumnSelect = modal.querySelector('.table-filter-column');
  const filterValueInput = modal.querySelector('.table-filter-value');
  const applyFilterBtn = modal.querySelector('.apply-filter-btn');
  const clearFilterBtn = modal.querySelector('.clear-filter-btn');

  function applySearchFilterAndSort() {
    let rows = [...table.rows];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedFilter = filterValue.trim().toLowerCase();

    // Global search within this table
    if (normalizedSearch) {
      rows = rows.filter(row => {
        return table.columns.some(col => {
          const cell = row[col.id];
          const text = cell === undefined || cell === null ? '' : String(cell).toLowerCase();
          return text.includes(normalizedSearch);
        });
      });
    }

    // Column filter
    if (filterColumnId && normalizedFilter) {
      rows = rows.filter(row => {
        const cell = row[filterColumnId];
        const text = cell === undefined || cell === null ? '' : String(cell).toLowerCase();
        return text.includes(normalizedFilter);
      });
    }

    // Sorting
    if (sortColumnId) {
      const colMeta = table.columns.find(c => c.id === sortColumnId);
      rows.sort((a, b) => {
        const av = a[sortColumnId];
        const bv = b[sortColumnId];
        if (colMeta && colMeta.type === 'number') {
          const an = Number(av) || 0;
          const bn = Number(bv) || 0;
          return sortDirection === 'asc' ? an - bn : bn - an;
        } else {
          const as = av === undefined || av === null ? '' : String(av).toLowerCase();
          const bs = bv === undefined || bv === null ? '' : String(bv).toLowerCase();
          return sortDirection === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
        }
      });
    }

    // Render
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${table.columns.length + 1}">No data available</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(row => `
      <tr data-id="${row.id}">
        ${table.columns.map(col => `<td>${formatCellValue(row[col.id], col.type)}</td>`).join('')}
        <td>
          <button class="edit-row" data-id="${row.id}">Edit</button>
          <button class="delete-row" data-id="${row.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    // Wire up row buttons after render
    tbody.querySelectorAll('.edit-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        editRow(tableId, e.target.getAttribute('data-id'), modal);
      });
    });
    tbody.querySelectorAll('.delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        deleteRow(tableId, e.target.getAttribute('data-id'), modal);
      });
    });

    // Update sort indicators
    modal.querySelectorAll('th.sortable .sort-indicator').forEach(el => { el.textContent = ''; });
    if (sortColumnId) {
      const th = modal.querySelector(`th[data-col-id="${sortColumnId}"] .sort-indicator`);
      if (th) th.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
  }

  // Initial render
  applySearchFilterAndSort();

  // Search events
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchTerm = searchInput.value;
      applySearchFilterAndSort();
    }
  });
  searchInput.addEventListener('blur', () => {
    searchTerm = searchInput.value;
    applySearchFilterAndSort();
  });

  // Filter events
  applyFilterBtn.addEventListener('click', () => {
    filterColumnId = filterColumnSelect.value;
    filterValue = filterValueInput.value;
    applySearchFilterAndSort();
  });
  clearFilterBtn.addEventListener('click', () => {
    filterColumnSelect.value = '';
    filterValueInput.value = '';
    filterColumnId = '';
    filterValue = '';
    applySearchFilterAndSort();
  });

  // Header click sorting
  modal.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const colId = th.getAttribute('data-col-id');
      if (!colId) return;
      if (sortColumnId === colId) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumnId = colId;
        sortDirection = 'asc';
      }
      applySearchFilterAndSort();
    });
  });

  // Clicking on a cell opens inline quick-filter for that column value
  tbody.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td');
    const tr = e.target.closest('tr');
    if (!td || !tr) return;
    const idx = Array.from(tr.children).indexOf(td);
    if (idx < 0 || idx >= table.columns.length) return;
    const colId = table.columns[idx].id;
    const val = td.textContent || '';
    filterColumnId = colId;
    filterValue = val;
    filterColumnSelect.value = colId;
    filterValueInput.value = val;
    applySearchFilterAndSort();
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
    case 'date':
      try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
    case 'datetime':
      try { return new Date(value).toLocaleString(); } catch { return String(value); }
    default:
      return value.toString();
  }
}

function openAnalyticsModal(tableId) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  const modal = document.createElement('div');
  modal.className = 'modal nested';
  const stats = computeTableStats(table);
  modal.innerHTML = `
    <div class=\"modal-content\">
      <div class=\"modal-header\"><h2>Analytics - ${table.name}</h2><button class=\"close-modal\">&times;</button></div>
      <div class=\"modal-body\">
        <div class=\"results-container\">
          <div><strong>Rows:</strong> ${stats.rowCount}</div>
          <div style=\"margin-top:0.5rem\">
            ${stats.columns.map(s => `<div style=\"margin-bottom:0.5rem\"><strong>${s.name}</strong> — ${s.summary}</div>`).join('')}
          </div>
        </div>
        <div style=\"margin-top:1rem\">
          <canvas id=\"chart1\" height=\"200\"></canvas>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', () => document.body.removeChild(modal));
  // Simple chart using Chart.js CDN
  const numericCols = table.columns.filter(c => c.type === 'number');
  if (numericCols.length) {
    loadChartJs().then(() => {
      const ctx = modal.querySelector('#chart1').getContext('2d');
      const labels = numericCols.map(c => c.name);
      const values = numericCols.map(c => {
        let sum = 0; let n = 0;
        table.rows.forEach(r => { const v = Number(r[c.id]); if (!isNaN(v)) { sum += v; n++; } });
        return n ? (sum / n) : 0;
      });
      new window.Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Mean', data: values }] }, options: { responsive: true } });
    });
  }
}

function openDuplicatesModal(tableId) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  const modal = document.createElement('div');
  modal.className = 'modal nested';
  modal.innerHTML = `
    <div class=\"modal-content\">
      <div class=\"modal-header\"><h2>Manage Duplicates - ${table.name}</h2><button class=\"close-modal\">&times;</button></div>
      <div class=\"modal-body\">
        <div class=\"form-row\">
          <label>Group by columns</label>
          <div class=\"columns-chooser\">
            ${table.columns.map(c => `<label style=\"margin-right:0.75rem\"><input type=\"checkbox\" value=\"${c.id}\"/> ${c.name}</label>`).join('')}
          </div>
        </div>
        <div class=\"form-actions\"><button class=\"primary-btn\" id=\"find-dups\">Find Duplicates</button></div>
        <div id=\"dups-results\" style=\"margin-top:1rem\"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => document.body.removeChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', close);
  const findBtn = modal.querySelector('#find-dups');
  const results = modal.querySelector('#dups-results');
  findBtn.addEventListener('click', () => {
    const selectedCols = Array.from(modal.querySelectorAll('.columns-chooser input:checked')).map(i => i.value);
    if (selectedCols.length === 0) { results.innerHTML = '<p class=\"empty-message\">Select columns to group by</p>'; return; }
    const groups = new Map();
    table.rows.forEach(r => {
      const key = selectedCols.map(cid => (r[cid] ?? '')).join('||');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    const dupGroups = [...groups.values()].filter(arr => arr.length > 1);
    if (!dupGroups.length) { results.innerHTML = '<p class=\"empty-message\">No duplicates found</p>'; return; }
    results.innerHTML = dupGroups.map((arr, idx) => `
      <div class=\"list-container\" style=\"margin-bottom:0.75rem\">
        <div style=\"margin-bottom:0.5rem\"><strong>Group ${idx + 1}</strong> (${arr.length} rows)</div>
        ${arr.map(r => `
          <div class=\"list-item\">
            <div class=\"item-content\">${selectedCols.map(cid => `<span class=\"item-meta\">${table.columns.find(c=>c.id===cid).name}: ${r[cid] ?? ''}</span>`).join(' • ')}</div>
            <div class=\"item-actions\">
              <button class=\"action-btn btn-keep\" data-id=\"${r.id}\">Keep</button>
              <button class=\"action-btn btn-delete\" data-id=\"${r.id}\">Delete</button>
            </div>
          </div>`).join('')}
      </div>`).join('');
    // Wire delete buttons
    results.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-id');
        // remove row
        const databases = getDatabases();
        const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
        const tIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
        databases[dbIndex].tables[tIndex].rows = databases[dbIndex].tables[tIndex].rows.filter(r => r.id !== rowId);
        saveDatabases(databases);
        // refresh dup search
        document.body.removeChild(modal);
        openDuplicatesModal(tableId);
      });
    });
    // Keep does nothing here; it exists for clarity
  });
}
function computeTableStats(table) {
  const result = { rowCount: table.rows.length, columns: [] };
  for (const col of table.columns) {
    if (col.type === 'number') {
      const nums = table.rows.map(r => Number(r[col.id])).filter(v => !isNaN(v));
      const count = nums.length;
      const sum = nums.reduce((a,b)=>a+b,0);
      const mean = count ? (sum / count) : 0;
      const min = count ? Math.min(...nums) : 0;
      const max = count ? Math.max(...nums) : 0;
      const variance = count ? nums.reduce((a,b)=>a+Math.pow(b-mean,2),0)/count : 0;
      const std = Math.sqrt(variance);
      result.columns.push({ name: col.name, summary: `count=${count}, mean=${mean.toFixed(2)}, min=${min}, max=${max}, std=${std.toFixed(2)}` });
    } else {
      // text/boolean/date: show distinct count
      const values = new Set(table.rows.map(r => r[col.id] ?? ''));
      result.columns.push({ name: col.name, summary: `distinct=${values.size}` });
    }
  }
  return result;
}

function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(s);
  });
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
  
  const formModal = document.createElement('div');
  formModal.className = 'modal nested';
  formModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Add Row</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form class="row-form">
          ${table.columns.map(col => `
            <div class="form-row">
              <label>${col.name} <span class="meta">${col.originalType || col.type}</span></label>
              <input name="col_${col.id}" type="text" placeholder="Enter ${col.name}" />
            </div>
          `).join('')}
          <div class="form-actions">
            <button type="submit" class="primary-btn">Save</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(formModal);
  const close = () => document.body.removeChild(formModal);
  formModal.querySelector('.close-modal').addEventListener('click', close);
  const form = formModal.querySelector('.row-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newRow = { id: Date.now().toString() };
    for (const col of table.columns) {
      let raw = form[`col_${col.id}`].value;
      let v = coerceValueByType(raw, col);
      if (col.type === 'text' && col.length && typeof v === 'string' && v.length > col.length) {
        v = v.substring(0, col.length);
      }
      newRow[col.id] = v;
    }
    const databases = getDatabases();
    const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
    const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
    if (dbIndex !== -1 && tableIndex !== -1) {
      databases[dbIndex].tables[tableIndex].rows.push(newRow);
      saveDatabases(databases);
      close();
      document.body.removeChild(modal);
      viewTable(tableId);
    }
  });
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
  
  const formModal = document.createElement('div');
  formModal.className = 'modal nested';
  formModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Row</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form class="row-form">
          ${table.columns.map(col => `
            <div class="form-row">
              <label>${col.name} <span=\"meta\">${col.originalType || col.type}</span></label>
              <input name="col_${col.id}" type="text" value="${row[col.id] === undefined || row[col.id] === null ? '' : String(row[col.id]).replace(/\"/g,'&quot;')}" />
            </div>
          `).join('')}
          <div class="form-actions">
            <button type="submit" class="primary-btn">Save</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(formModal);
  const close = () => document.body.removeChild(formModal);
  formModal.querySelector('.close-modal').addEventListener('click', close);
  const form = formModal.querySelector('.row-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    for (const col of table.columns) {
      let raw = form[`col_${col.id}`].value;
      let v = coerceValueByType(raw, col);
      if (col.type === 'text' && col.length && typeof v === 'string' && v.length > col.length) {
        v = v.substring(0, col.length);
      }
      row[col.id] = v;
    }
    const databases = getDatabases();
    const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
    const tableIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
    if (dbIndex !== -1 && tableIndex !== -1) {
      const rowIndex = databases[dbIndex].tables[tableIndex].rows.findIndex(r => r.id === rowId);
      if (rowIndex !== -1) {
        databases[dbIndex].tables[tableIndex].rows[rowIndex] = row;
        saveDatabases(databases);
        close();
        document.body.removeChild(modal);
        viewTable(tableId);
      }
    }
  });
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

function openCreateTableModal() {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) { alert('Please select a database first.'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create Table</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form class="create-table-form">
          <div class="form-row">
            <label>Table Name</label>
            <input name="tableName" type="text" placeholder="e.g., Students" required />
          </div>
          <div class="form-row">
            <label>Number of Columns</label>
            <input name="colCount" type="number" min="1" value="1" />
            <button type="button" class="primary-btn generate-cols">Generate</button>
          </div>
          <div class="columns-container"></div>
          <div class="form-actions">
            <button type="submit" class="primary-btn">Create Table</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => document.body.removeChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', close);
  const form = modal.querySelector('.create-table-form');
  const colsContainer = modal.querySelector('.columns-container');
  const genBtn = modal.querySelector('.generate-cols');
  function renderCols(n) {
    colsContainer.innerHTML = Array.from({ length: n }).map((_, i) => `
      <div class="form-grid">
        <div>
          <label>Column ${i + 1} Name</label>
          <input name="col_name_${i}" type="text" required />
        </div>
        <div>
          <label>SQL Type</label>
          <input name="col_type_${i}" type="text" placeholder="e.g., VARCHAR(50), INT, DECIMAL(10,2), DATE" required />
        </div>
        <div class="checkbox">
          <label><input name="col_pk_${i}" type="checkbox" ${i === 0 ? 'checked' : ''}/> Primary Key</label>
        </div>
      </div>
    `).join('');
  }
  genBtn.addEventListener('click', () => {
    const count = parseInt(form.colCount.value, 10);
    if (isNaN(count) || count < 1) return;
    renderCols(count);
  });
  renderCols(parseInt(form.colCount.value, 10));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tableName = form.tableName.value.trim();
    if (!tableName) return;
    if (getSelectedDatabase().tables.some(t => t.name === tableName)) { alert('A table with this name already exists.'); return; }
    const count = parseInt(form.colCount.value, 10);
    const columns = [];
    for (let i = 0; i < count; i++) {
      const name = form[`col_name_${i}`].value.trim();
      const typeStr = form[`col_type_${i}`].value.trim();
      if (!name || !typeStr) { alert('Please fill all column fields.'); return; }
      const parsed = parseSqlType(typeStr);
      if (!parsed) { alert(`Invalid type for column ${name}`); return; }
      columns.push({
        id: Date.now().toString() + i,
        name,
        type: parsed.baseType,
        originalType: parsed.original,
        length: parsed.length || null,
        precision: parsed.precision || null,
        scale: parsed.scale || null,
        isPrimaryKey: !!form[`col_pk_${i}`].checked
      });
    }
    const newTable = { id: Date.now().toString(), name: tableName, columns, rows: [], createdAt: new Date().toISOString() };
    const databases = getDatabases();
    const selected = getSelectedDatabase();
    const dbIndex = databases.findIndex(db => db.id === selected.id);
    if (dbIndex !== -1) {
      databases[dbIndex].tables.push(newTable);
      saveDatabases(databases);
      loadTables(databases[dbIndex]);
      close();
    }
  });
}

function coerceValueByType(rawValue, column) {
  if (rawValue === undefined || rawValue === null) return null;
  const v = String(rawValue).trim();
  switch (column.type) {
    case 'number': {
      const num = Number(v);
      if (isNaN(num)) return 0;
      if (typeof column.scale === 'number' && typeof column.precision === 'number') {
        return Number(num.toFixed(column.scale));
      }
      return num;
    }
    case 'boolean':
      return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
    case 'date': {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toISOString().substring(0, 10);
    }
    case 'datetime': {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toISOString();
    }
    default:
      return v;
  }
}

function openRenameTableModal(tableId, parentModal) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  const modal = document.createElement('div');
  modal.className = 'modal nested';
  modal.innerHTML = `
    <div class=\"modal-content\">
      <div class=\"modal-header\">
        <h2>Rename Table</h2>
        <button class=\"close-modal\">&times;</button>
      </div>
      <div class=\"modal-body\">
        <form class=\"rename-form\">
          <div class=\"form-row\">
            <label>New name</label>
            <input name=\"newName\" type=\"text\" value=\"${table.name.replace(/\"/g,'&quot;')}\" required />
          </div>
          <div class=\"form-actions\">
            <button type=\"submit\" class=\"primary-btn\">Save</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => document.body.removeChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', close);
  modal.querySelector('.rename-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = e.target.newName.value.trim();
    if (!newName) return;
    if (selectedDb.tables.some(t => t.name.toLowerCase() === newName.toLowerCase() && t.id !== tableId)) {
      alert('Another table already has this name.');
      return;
    }
    const databases = getDatabases();
    const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
    const tIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
    databases[dbIndex].tables[tIndex].name = newName;
    saveDatabases(databases);
    close();
    document.body.removeChild(parentModal);
    viewTable(tableId);
  });
}

function openManageColumnsModal(tableId, parentModal) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) return;
  const table = selectedDb.tables.find(t => t.id === tableId);
  if (!table) return;
  const modal = document.createElement('div');
  modal.className = 'modal nested';
  modal.innerHTML = `
    <div class=\"modal-content\">
      <div class=\"modal-header\">
        <h2>Manage Columns</h2>
        <button class=\"close-modal\">&times;</button>
      </div>
      <div class=\"modal-body\">
        <form class=\"cols-form\">
          ${table.columns.map((col, i) => `
            <div class=\"form-grid\">
              <div>
                <label>Name</label>
                <input name=\"name_${col.id}\" type=\"text\" value=\"${col.name.replace(/\"/g,'&quot;')}\" />
              </div>
              <div>
                <label>Type</label>
                <input name=\"type_${col.id}\" type=\"text\" value=\"${col.originalType || col.type}\" />
              </div>
              <div class=\"checkbox\">
                <label><input name=\"pk_${col.id}\" type=\"checkbox\" ${col.isPrimaryKey ? 'checked' : ''}/> Primary Key</label>
              </div>
              <div>
                <button type=\"button\" class=\"delete-col-btn\" data-col=\"${col.id}\">Delete</button>
              </div>
            </div>
          `).join('')}
          <div class=\"form-actions\" style=\"margin-top:1rem;\">
            <button type=\"button\" class=\"add-col-btn secondary-btn\">Add Column</button>
            <div style=\"flex:1\"></div>
            <button type=\"submit\" class=\"primary-btn\">Save Changes</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => document.body.removeChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', close);
  const form = modal.querySelector('.cols-form');
  
  // Add column handler
  form.querySelector('.add-col-btn').addEventListener('click', () => {
    const div = document.createElement('div');
    const newId = 'new_' + Date.now().toString();
    div.className = 'form-grid';
    div.innerHTML = `
      <div>
        <label>Name</label>
        <input name=\"name_${newId}\" type=\"text\" placeholder=\"New column\" />
      </div>
      <div>
        <label>Type</label>
        <input name=\"type_${newId}\" type=\"text\" placeholder=\"e.g., VARCHAR(50)\" />
      </div>
      <div class=\"checkbox\">
        <label><input name=\"pk_${newId}\" type=\"checkbox\"/> Primary Key</label>
      </div>
      <div>
        <button type=\"button\" class=\"delete-col-btn\" data-col=\"${newId}\">Delete</button>
      </div>`;
    form.insertBefore(div, form.lastElementChild);
    wireDeleteButtons();
  });
  
  function wireDeleteButtons() {
    form.querySelectorAll('.delete-col-btn').forEach(btn => {
      btn.onclick = () => {
        const grid = btn.closest('.form-grid');
        grid.parentNode.removeChild(grid);
      };
    });
  }
  wireDeleteButtons();
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const databases = getDatabases();
    const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
    const tIndex = databases[dbIndex].tables.findIndex(t => t.id === tableId);
    const existing = databases[dbIndex].tables[tIndex];
    
    // Build new columns list
    const grids = Array.from(form.querySelectorAll('.form-grid'));
    const newColumns = [];
    for (const grid of grids) {
      const delBtn = grid.querySelector('.delete-col-btn');
      const colId = delBtn.getAttribute('data-col');
      const nameInput = grid.querySelector(`[name^="name_${colId}"]`);
      const typeInput = grid.querySelector(`[name^="type_${colId}"]`);
      const pkInput = grid.querySelector(`[name^="pk_${colId}"]`);
      const name = nameInput ? nameInput.value.trim() : '';
      const typeStr = typeInput ? typeInput.value.trim() : '';
      if (!name || !typeStr) continue;
      const parsed = parseSqlType(typeStr);
      if (!parsed) { alert(`Invalid type for column ${name}`); return; }
      const old = existing.columns.find(c => c.id === colId);
      newColumns.push({
        id: old ? old.id : (Date.now().toString() + Math.random().toString(36).slice(2)),
        name,
        type: parsed.baseType,
        originalType: parsed.original,
        length: parsed.length || null,
        precision: parsed.precision || null,
        scale: parsed.scale || null,
        isPrimaryKey: pkInput && pkInput.checked
      });
    }
    if (new Set(newColumns.map(c => c.name.toLowerCase())).size !== newColumns.length) {
      alert('Duplicate column names are not allowed.');
      return;
    }
    // Rebuild rows mapping old columns to new
    const newRows = existing.rows.map(r => {
      const nr = { id: r.id };
      for (const col of newColumns) {
        const prev = existing.columns.find(c => c.name.toLowerCase() === col.name.toLowerCase()) || existing.columns.find(c => c.id === col.id);
        const raw = prev ? r[prev.id] : '';
        nr[col.id] = coerceValueByType(raw, col);
      }
      return nr;
    });
    databases[dbIndex].tables[tIndex].columns = newColumns;
    databases[dbIndex].tables[tIndex].rows = newRows;
    saveDatabases(databases);
    close();
    document.body.removeChild(parentModal);
    viewTable(tableId);
  });
}
// Import helpers
function inferTypeFromSamples(values) {
  // Try number
  const nums = values.map(v => Number(String(v).trim()));
  if (nums.every(n => !isNaN(n))) return { baseType: 'number' };
  // Try boolean
  const boolSet = new Set(values.map(v => String(v).trim().toLowerCase()));
  const boolVals = ['true','false','1','0','yes','no'];
  if ([...boolSet].every(v => boolVals.includes(v))) return { baseType: 'boolean' };
  // Try date/datetime
  const asDates = values.map(v => new Date(String(v).trim()));
  if (asDates.every(d => !isNaN(d.getTime()))) {
    const hasTime = values.some(v => /\d{1,2}:\d{2}/.test(String(v)));
    return { baseType: hasTime ? 'datetime' : 'date' };
  }
  // Fallback text with max length
  const maxLen = values.reduce((m, v) => Math.max(m, String(v).length), 0);
  return { baseType: 'text', length: Math.min(Math.max( Math.ceil(maxLen/10)*10, 20), 255) };
}

async function handleImportFile(file) {
  const selectedDb = getSelectedDatabase();
  if (!selectedDb) { alert('Please select a database first.'); return; }
  const nameParts = file.name.split('.');
  const ext = nameParts[nameParts.length - 1].toLowerCase();
  try {
    let tableData;
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      const text = await file.text();
      const delimiter = ext === 'tsv' ? '\t' : (text.includes('\t') && !text.includes(',') ? '\t' : ',');
      tableData = parseDelimited(text, delimiter);
    } else if (ext === 'xls' || ext === 'xlsx') {
      const { rows, headers } = await parseExcelFile(file);
      tableData = { headers, rows };
    } else {
      alert('Unsupported file type. Please upload CSV, TSV, TXT, XLS or XLSX.');
      return;
    }
    await createTableFromImportedData(selectedDb, file.name.replace(/\.[^.]+$/, ''), tableData.headers, tableData.rows);
    // Refresh tables
    const databases = getDatabases();
    const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
    if (dbIndex !== -1) loadTables(databases[dbIndex]);
  } catch (e) {
    alert('Import failed: ' + e.message);
  }
}

function parseDelimited(text, delimiter) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error('Empty file');
  // naive CSV/TSV: split by delimiter, no quote escaping for simplicity
  const rows = lines.map(l => l.split(delimiter).map(s => s.trim()));
  const headers = rows.shift();
  return { headers, rows };
}

async function parseExcelFile(file) {
  // Load SheetJS from CDN dynamically
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load XLSX library'));
      document.head.appendChild(s);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (json.length === 0) throw new Error('Empty sheet');
  const headers = json.shift();
  const rows = json;
  return { headers, rows };
}

async function createTableFromImportedData(selectedDb, baseName, headers, rowArrays) {
  // Infer columns types from first up to 20 rows
  const sampleCount = Math.min(20, rowArrays.length);
  const samplesByCol = headers.map((_, c) => rowArrays.slice(0, sampleCount).map(r => r[c] ?? ''));
  const inferred = samplesByCol.map(values => inferTypeFromSamples(values));
  const columns = headers.map((h, i) => ({
    id: Date.now().toString() + '_' + i,
    name: String(h || `col_${i+1}`),
    type: inferred[i].baseType,
    originalType: inferred[i].baseType === 'text' && inferred[i].length ? `VARCHAR(${inferred[i].length})` : (inferred[i].baseType.toUpperCase()),
    length: inferred[i].length || null,
    precision: null,
    scale: null,
    isPrimaryKey: i === 0
  }));
  const newTable = { id: Date.now().toString(), name: uniqueTableName(selectedDb, baseName), columns, rows: [], createdAt: new Date().toISOString() };
  const databases = getDatabases();
  const dbIndex = databases.findIndex(db => db.id === selectedDb.id);
  if (dbIndex === -1) throw new Error('Database not found');
  // Build rows
  for (const arr of rowArrays) {
    const row = { id: Date.now().toString() + Math.random().toString(36).slice(2) };
    columns.forEach((col, idx) => {
      const raw = arr[idx] ?? '';
      row[col.id] = coerceValueByType(raw, col);
    });
    newTable.rows.push(row);
  }
  databases[dbIndex].tables.push(newTable);
  saveDatabases(databases);
}

function uniqueTableName(db, base) {
  let name = base.replace(/[^A-Za-z0-9_]/g, '_');
  if (!name) name = 'imported_table';
  let candidate = name;
  let i = 1;
  while (db.tables.some(t => t.name.toLowerCase() === candidate.toLowerCase())) {
    candidate = `${name}_${i++}`;
  }
  return candidate;
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
    animation: scaleIn 180ms ease-out;
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
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
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
  
  .sortable {
    cursor: pointer;
    user-select: none;
  }
  
  .sort-indicator {
    font-size: 0.8rem;
    opacity: 0.8;
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