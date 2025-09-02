import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'

// Import our custom modules
import { initDatabaseOperations } from './database.js'
import { initTableOperations } from './table.js'
import { initQueryOperations } from './query.js'

// Main application HTML structure
document.querySelector('#app').innerHTML = `
  <div class="container">
    <header class="app-header">
      <div class="logo-container">
        <img src="${viteLogo}" class="logo" alt="Vite logo" />
        <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
      </div>
      <h1>RDBMS Project</h1>
    </header>
    
    <main class="app-main">
      <div class="sidebar">
        <h2>Databases</h2>
        <div id="database-list" class="list-container">
          <p class="empty-message">No databases created</p>
        </div>
        <button id="create-db-btn" class="primary-btn">Create Database</button>
      </div>
      
      <div class="content">
        <div class="tab-container">
          <button class="tab-btn active" data-tab="tables">Tables</button>
          <button class="tab-btn" data-tab="query">Query</button>
        </div>
        
        <div id="tables-panel" class="panel active">
          <h2>Tables</h2>
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
});
