import './style.css'
import Logo from '../public/amitybengaluru_logo.jpeg'

// Import our custom modules
import { initDatabaseOperations, getDatabases } from './database.js'
import { initTableOperations, viewTable } from './table.js'
import { initQueryOperations } from './query.js'

// Main application HTML structure
document.querySelector('#app').innerHTML = `
  <div class="container">
    <header class="app-header">
      <div class="logo-container">
        <img src="${Logo}" class="logo vanilla" alt="Amity Logo" />
      </div>
      <h1>RDBMS Project</h1>
    </header>
    
    <main class="app-main">
      <div class="sidebar">
        <h2>Databases</h2>
        <div class="global-search">
          <input id="global-search-input" type="text" placeholder="Search all databases..." />
          <button id="global-search-btn" class="primary-btn">Search</button>
        </div>
        <div id="database-list" class="list-container">
          <p class="empty-message">No databases created</p>
        </div>
        <button id="create-db-btn" class="primary-btn">Create Database</button>
      </div>
      
      <div class="content">
        <div class="tab-container">
          <button class="tab-btn" data-tab="databases">Databases</button>
          <button class="tab-btn active" data-tab="tables">Tables</button>
          <button class="tab-btn" data-tab="query">Query</button>
        </div>
        
        <div id="databases-panel" class="panel">
          <h2>All Databases</h2>
          <div id="databases-overview" class="list-container"></div>
          <div id="db-tables-view" class="list-container" style="margin-top: 1rem;"></div>
          <div id="global-search-results" class="results-container">
            <p class="empty-message">Use the global search to find across all data</p>
          </div>
        </div>
        
        <div id="tables-panel" class="panel active">
          <h2>Tables</h2>
          <div class="import-controls" style="margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <input id="import-file-input" type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" />
            <button id="import-file-btn" class="primary-btn" disabled>Import File as Table</button>
          </div>
          <div id="table-list" class="list-container">
            <p class="empty-message">No tables available</p>
          </div>
          <button id="create-table-btn" class="primary-btn" disabled>Create Table</button>
        </div>
        
        <div id="query-panel" class="panel">
          <h2>SQL Query</h2>
          <textarea id="sql-query" placeholder="Enter your SQL query here..."></textarea>
          <button id="execute-query-btn" class="primary-btn" disabled>Execute Query</button>
          <div id="query-results" class="results-container">
            <p class="empty-message">No results to display</p>
          </div>
        </div>
      </div>
    </main>
    
    <footer class="app-footer">
      <p>RDBMS Project - CSE5006</p>
    </footer>
  </div>
`

// Initialize all modules
document.addEventListener('DOMContentLoaded', () => {
  initDatabaseOperations();
  initTableOperations();
  initQueryOperations();
  
  // Populate databases panel overview
  renderDatabasesOverview();
  
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and panels
      tabButtons.forEach(btn => btn.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));
      
      // Add active class to clicked button and corresponding panel
      button.classList.add('active');
      const tabName = button.getAttribute('data-tab');
      document.getElementById(`${tabName}-panel`).classList.add('active');
    });
  });
  
  // Global search handlers
  const globalSearchBtn = document.getElementById('global-search-btn');
  const globalSearchInput = document.getElementById('global-search-input');
  const triggerGlobalSearch = () => {
    const term = globalSearchInput.value.trim();
    runGlobalSearch(term);
    // Switch to databases tab to show results
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.querySelector('[data-tab="databases"]').classList.add('active');
    document.getElementById('databases-panel').classList.add('active');
  };
  globalSearchBtn.addEventListener('click', triggerGlobalSearch);
  globalSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerGlobalSearch();
  });
  // Export open
  document.addEventListener('open-export', (e) => {
    openExportDialog(e.detail || {});
  });
});

// Render overview of databases and tables
function renderDatabasesOverview() {
  const container = document.getElementById('databases-overview');
  if (!container) return;
  const databases = getDatabases();
  const selectedDbId = localStorage.getItem('selected_database');
  const selected = databases.find(d => d.id === selectedDbId) || null;
  if (databases.length === 0) {
    container.innerHTML = '<p class="empty-message">No databases created</p>';
    document.getElementById('db-tables-view').innerHTML = '';
    return;
  }
  container.innerHTML = '';
  databases.forEach(db => {
    const dbDiv = document.createElement('div');
    dbDiv.className = 'list-item' + (selected && selected.id === db.id ? ' selected' : '');
    dbDiv.innerHTML = `
      <div class="item-content">
        <span class="item-name">${db.name}</span>
        <span class="item-meta">${db.tables.length} tables</span>
      </div>
      <div class="item-actions"><button class="action-btn">Open</button></div>
    `;
    dbDiv.querySelector('.action-btn').addEventListener('click', () => {
      localStorage.setItem('selected_database', db.id);
      const event = new CustomEvent('database-selected', { detail: db });
      document.dispatchEvent(event);
      renderDatabasesOverview();
      renderTablesOfDatabase(db);
    });
    container.appendChild(dbDiv);
  });
  if (selected) renderTablesOfDatabase(selected); else document.getElementById('db-tables-view').innerHTML = '';
}

function renderTablesOfDatabase(db) {
  const container = document.getElementById('db-tables-view');
  if (!container) return;
  if (!db || !db.tables || db.tables.length === 0) {
    container.innerHTML = '<p class="empty-message">No tables in this database</p>';
    return;
  }
  container.innerHTML = db.tables.map(t => `
    <div class="list-item">
      <div class="item-content">
        <span class="item-name">${t.name}</span>
        <span class="item-meta">${t.columns.length} columns, ${t.rows.length} rows</span>
      </div>
      <div class="item-actions">
        <button class="action-btn btn-view" data-id="${t.id}">View</button>
        <button class="action-btn btn-export" data-id="${t.id}">Export</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tableId = e.target.getAttribute('data-id');
      const evt = new CustomEvent('open-table', { detail: { tableId } });
      document.dispatchEvent(evt);
    });
  });
  container.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tableId = e.target.getAttribute('data-id');
      openExportDialog({ scope: 'table', tableId });
    });
  });
}

// Global search across databases, tables, columns and rows
function runGlobalSearch(term) {
  const resultsContainer = document.getElementById('global-search-results');
  if (!resultsContainer) return;
  if (!term) {
    resultsContainer.innerHTML = '<p class="empty-message">Enter a term to search across all databases</p>';
    return;
  }
  const databases = getDatabases();
  const matches = [];
  const normalized = term.toLowerCase();
  databases.forEach(db => {
    if (db.name.toLowerCase().includes(normalized)) {
      matches.push({ type: 'database', dbName: db.name });
    }
    db.tables.forEach(table => {
      if (table.name.toLowerCase().includes(normalized)) {
        matches.push({ type: 'table', dbName: db.name, tableName: table.name });
      }
      // Column names
      table.columns.forEach(col => {
        if (col.name.toLowerCase().includes(normalized)) {
          matches.push({ type: 'column', dbName: db.name, tableName: table.name, columnName: col.name });
        }
      });
      // Row cell values
      table.rows.forEach(row => {
        for (const col of table.columns) {
          const cell = row[col.id];
          const text = cell === undefined || cell === null ? '' : String(cell).toLowerCase();
          if (text.includes(normalized)) {
            matches.push({ type: 'row', dbName: db.name, tableName: table.name, columnName: col.name, value: String(cell) });
            break;
          }
        }
      });
    });
  });
  if (matches.length === 0) {
    resultsContainer.innerHTML = '<p class="empty-message">No matches found</p>';
    return;
  }
  const list = document.createElement('div');
  list.className = 'list-container';
  list.innerHTML = matches.map(m => {
    if (m.type === 'database') return `<div class="list-item"><div class="item-content"><span class="item-name">Database: ${m.dbName}</span></div></div>`;
    if (m.type === 'table') return `<div class="list-item"><div class="item-content"><span class="item-name">Table: ${m.tableName}</span><span class="item-meta">in ${m.dbName}</span></div></div>`;
    if (m.type === 'column') return `<div class="list-item"><div class="item-content"><span class="item-name">Column: ${m.columnName}</span><span class="item-meta">${m.tableName} in ${m.dbName}</span></div></div>`;
    return `<div class="list-item"><div class="item-content"><span class="item-name">Match in ${m.tableName}.${m.columnName}</span><span class="item-meta">${m.dbName} — "${m.value}"</span></div></div>`;
  }).join('');
  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(list);
}

// Export dialog and helpers
function openExportDialog({ scope, tableId } = {}) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Export Data</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Format</label>
          <select id="export-format">
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        ${scope === 'table' ? '' : '<div class="form-row"><label>Select Tables</label><div id="export-tables-list"></div></div>'}
        <div class="form-actions"><button id="export-confirm" class="primary-btn">Download</button></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', () => document.body.removeChild(modal));
  const { getSelectedDatabase } = require('./database.js');
  const db = getSelectedDatabase();
  let selectedTableIds = [];
  if (scope !== 'table') {
    const list = modal.querySelector('#export-tables-list');
    if (db && db.tables.length) {
      list.innerHTML = db.tables.map(t => `<label style="display:block"><input type="checkbox" value="${t.id}" checked /> ${t.name}</label>`).join('');
      selectedTableIds = db.tables.map(t => t.id);
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          selectedTableIds = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
        });
      });
    } else {
      list.innerHTML = '<p class="empty-message">No tables</p>';
    }
  } else {
    selectedTableIds = [tableId];
  }
  modal.querySelector('#export-confirm').addEventListener('click', async () => {
    const fmt = modal.querySelector('#export-format').value;
    await exportData({ db, tableIds: selectedTableIds, format: fmt });
    document.body.removeChild(modal);
  });
}

async function exportData({ db, tableIds, format }) {
  if (!db || !tableIds || tableIds.length === 0) return;
  const data = db.tables.filter(t => tableIds.includes(t.id));
  if (format === 'csv') {
    // if multiple, create multi-CSV blob separated by two newlines
    const parts = data.map(t => tableToCSV(t));
    const blob = new Blob([parts.join('\n\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${db.name}_${Date.now()}.csv`);
  } else if (format === 'xlsx') {
    if (!window.XLSX) await loadSheetJs();
    const wb = window.XLSX.utils.book_new();
    data.forEach(t => {
      const aoa = tableToAOA(t);
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      window.XLSX.utils.book_append_sheet(wb, ws, safeSheetName(t.name));
    });
    const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, `${db.name}_${Date.now()}.xlsx`);
  } else if (format === 'pdf') {
    // Lightweight PDF: use jsPDF + autoTable via CDN
    await loadJsPDF();
    const doc = new window.jspdf.jsPDF();
    data.forEach((t, idx) => {
      if (idx > 0) doc.addPage();
      doc.text(t.name, 14, 16);
      const headers = t.columns.map(c => c.name);
      const rows = t.rows.map(r => t.columns.map(c => r[c.id] ?? ''));
      if (window.jspdf && window.jspdf.autoTable) {
        window.jspdf.autoTable(doc, { head: [headers], body: rows, startY: 22, styles: { fontSize: 8 } });
      }
    });
    doc.save(`${db.name}_${Date.now()}.pdf`);
  }
}

function tableToCSV(table) {
  const headers = table.columns.map(c => escapeCsv(c.name)).join(',');
  const lines = table.rows.map(r => table.columns.map(c => escapeCsv(r[c.id] ?? '')).join(','));
  return [headers, ...lines].join('\n');
}

function escapeCsv(val) {
  const s = String(val).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function tableToAOA(table) {
  const headers = table.columns.map(c => c.name);
  const rows = table.rows.map(r => table.columns.map(c => r[c.id] ?? ''));
  return [headers, ...rows];
}

async function loadSheetJs() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
}

async function loadJsPDF() {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.head.appendChild(s);
    });
  }
  if (!window.jspdf || !window.jspdf.autoTable) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load jsPDF autotable'));
      document.head.appendChild(s);
    });
  }
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Refresh overview when databases change/selection changes
document.addEventListener('database-selected', () => {
  renderDatabasesOverview();
});
