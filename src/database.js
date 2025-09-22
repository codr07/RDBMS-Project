/**
 * Database operations module for RDBMS Project
 * Handles creating, selecting, and managing databases
 */

// Store databases in localStorage
const STORAGE_KEY = 'rdbms_databases';

/**
 * Initialize database operations
 */
export function initDatabaseOperations() {
  // Initialize event listeners
  const createDbBtn = document.getElementById('create-db-btn');
  createDbBtn.addEventListener('click', createDatabase);
  
  // Load existing databases
  loadDatabases();
}

/**
 * Load existing databases from localStorage
 */
function loadDatabases() {
  const databaseList = document.getElementById('database-list');
  const databases = getDatabases();
  
  if (databases.length === 0) {
    databaseList.innerHTML = '<p class="empty-message">No databases created</p>';
    return;
  }
  
  // Clear the list
  databaseList.innerHTML = '';
  
  // Create list items for each database
  databases.forEach(db => {
    const dbItem = document.createElement('div');
    dbItem.className = 'list-item';
    dbItem.innerHTML = `
      <div class="item-content">
        <span class="item-name">${db.name}</span>
        <span class="item-meta">${db.tables.length} tables</span>
      </div>
      <div class="item-actions">
        <button class="action-btn select-db" data-id="${db.id}">Select</button>
        <button class="action-btn view-db" data-id="${db.id}">View</button>
        <button class="action-btn delete-db" data-id="${db.id}">Delete</button>
      </div>
    `;
    databaseList.appendChild(dbItem);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.select-db').forEach(btn => {
    btn.addEventListener('click', (e) => selectDatabase(e.target.getAttribute('data-id')));
  });
  
  document.querySelectorAll('.delete-db').forEach(btn => {
    btn.addEventListener('click', (e) => deleteDatabase(e.target.getAttribute('data-id')));
  });

  // View database tables directly in content area
  document.querySelectorAll('.view-db').forEach(btn => {
    btn.addEventListener('click', (e) => showDatabaseTables(e.target.getAttribute('data-id')));
  });
}

/**
 * Create a new database
 */
function createDatabase() {
  const dbName = prompt('Enter database name:');
  
  if (!dbName) return;
  
  const databases = getDatabases();
  
  // Check if database with same name exists
  if (databases.some(db => db.name === dbName)) {
    alert('A database with this name already exists!');
    return;
  }
  
  // Create new database
  const newDb = {
    id: Date.now().toString(),
    name: dbName,
    tables: [],
    createdAt: new Date().toISOString()
  };
  
  // Add to databases and save
  databases.push(newDb);
  saveDatabases(databases);
  
  // Reload the list
  loadDatabases();
  
  // Select the new database
  selectDatabase(newDb.id);
}

/**
 * Select a database
 * @param {string} dbId - Database ID
 */
function selectDatabase(dbId) {
  const databases = getDatabases();
  const selectedDb = databases.find(db => db.id === dbId);
  
  if (!selectedDb) return;
  
  // Store selected database ID
  localStorage.setItem('selected_database', dbId);
  
  // Update UI to show selected database
  document.querySelectorAll('.list-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = document.querySelector(`.select-db[data-id="${dbId}"]`).closest('.list-item');
  selectedItem.classList.add('selected');
  
  // Enable create table button
  document.getElementById('create-table-btn').disabled = false;
  document.getElementById('execute-query-btn').disabled = false;
  
  // Load tables for this database
  const event = new CustomEvent('database-selected', { detail: selectedDb });
  document.dispatchEvent(event);
}

function showDatabaseTables(dbId) {
  const databases = getDatabases();
  const db = databases.find(d => d.id === dbId);
  if (!db) return;
  // Switch to tables tab
  const tablesTabBtn = document.querySelector('[data-tab="tables"]');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');
  tabButtons.forEach(btn => btn.classList.remove('active'));
  panels.forEach(panel => panel.classList.remove('active'));
  tablesTabBtn.classList.add('active');
  document.getElementById('tables-panel').classList.add('active');
  // Select database to load its tables
  selectDatabase(dbId);
}

/**
 * Delete a database
 * @param {string} dbId - Database ID
 */
function deleteDatabase(dbId) {
  if (!confirm('Are you sure you want to delete this database? This action cannot be undone.')) {
    return;
  }
  
  let databases = getDatabases();
  databases = databases.filter(db => db.id !== dbId);
  saveDatabases(databases);
  
  // If the deleted database was selected, clear selection
  const selectedDbId = localStorage.getItem('selected_database');
  if (selectedDbId === dbId) {
    localStorage.removeItem('selected_database');
    document.getElementById('create-table-btn').disabled = true;
    document.getElementById('execute-query-btn').disabled = true;
    
    // Clear tables
    const event = new CustomEvent('database-selected', { detail: null });
    document.dispatchEvent(event);
  }
  
  // Reload the list
  loadDatabases();
}

/**
 * Get all databases from localStorage
 * @returns {Array} Array of database objects
 */
export function getDatabases() {
  const databasesJson = localStorage.getItem(STORAGE_KEY);
  return databasesJson ? JSON.parse(databasesJson) : [];
}

/**
 * Save databases to localStorage
 * @param {Array} databases - Array of database objects
 */
export function saveDatabases(databases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(databases));
}

/**
 * Get the currently selected database
 * @returns {Object|null} Selected database or null if none selected
 */
export function getSelectedDatabase() {
  const selectedDbId = localStorage.getItem('selected_database');
  if (!selectedDbId) return null;
  
  const databases = getDatabases();
  return databases.find(db => db.id === selectedDbId) || null;
}

// Add some CSS for database list items
const style = document.createElement('style');
style.textContent = `
  .list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.2s;
  }
  
  .list-item:last-child {
    border-bottom: none;
  }
  
  .list-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .list-item.selected {
    background-color: rgba(59, 130, 246, 0.2);
  }
  
  .item-content {
    display: flex;
    flex-direction: column;
  }
  
  .item-name {
    font-weight: 500;
  }
  
  .item-meta {
    font-size: 0.8rem;
    color: #888;
  }
  
  .item-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-btn {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }
  
  .select-db {
    background-color: var(--primary-color);
    color: white;
  }
  
  .delete-db {
    background-color: var(--danger-color);
    color: white;
  }
  
  @media (prefers-color-scheme: light) {
    .list-item:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
  }
`;

document.head.appendChild(style);