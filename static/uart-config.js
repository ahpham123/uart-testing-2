/**
 * UART Port Configuration JavaScript
 * Frontend logic for managing UART port configurations
 * Author: Assistant
 * Version: 1.0
 */

// =============================================================================
// CONFIGURATION AND GLOBAL VARIABLES
// =============================================================================

// Configuration data
let portConfigs = {};
let availableBaudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
let availableParity = ['none', 'even', 'odd'];
let isLoading = false;

// API base URL - adjust this to match your Flask backend
const API_BASE = 'http://localhost:5000';

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000;

// Message display timeout (4 seconds)
const MESSAGE_TIMEOUT = 4000;

// Global message timeout (5 seconds)
const GLOBAL_MESSAGE_TIMEOUT = 5000;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('UART Configuration App initialized');
    loadPortConfigs();
    
    // Set up auto-refresh
    setInterval(loadPortConfigs, REFRESH_INTERVAL);
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Set up visual feedback
    setupVisualFeedback();
});

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            loadPortConfigs();
        }
    });
}

/**
 * Set up visual feedback for button interactions
 */
function setupVisualFeedback() {
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') {
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                e.target.style.transform = '';
            }, 100);
        }
    });
}

// =============================================================================
// API COMMUNICATION
// =============================================================================

/**
 * Load port configurations from the backend
 */
async function loadPortConfigs() {
    if (isLoading) return;
    
    isLoading = true;
    updateRefreshButton(true);
    updateConnectionStatus('loading', 'Loading...');

    try {
        const response = await fetch(`${API_BASE}/api/ports`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        portConfigs = data.ports;
        availableBaudRates = data.available_baud_rates || availableBaudRates;
        availableParity = data.available_parity || availableParity;
        
        renderPortCards();
        updateConnectionStats();
        updateConnectionStatus('connected', 'Connected to Backend');
        
        console.log('Port configurations loaded successfully');
        
    } catch (error) {
        console.error('Error loading port configurations:', error);
        updateConnectionStatus('error', 'Backend Connection Failed');
        showGlobalMessage('Error loading port configurations. Please check if the backend server is running.', 'error');
        
        // Show default configuration if backend is unavailable
        if (Object.keys(portConfigs).length === 0) {
            portConfigs = {
                '/dev/ttyAMA0': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'},
                '/dev/ttyAMA1': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'},
                '/dev/ttyAMA2': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'}
            };
            renderPortCards();
            updateConnectionStats();
        }
    } finally {
        isLoading = false;
        updateRefreshButton(false);
    }
}

/**
 * Configure a specific UART port
 * @param {string} port - The port to configure (e.g., '/dev/ttyAMA0')
 */
async function configurePort(port) {
    const baudRate = parseInt(document.getElementById(`baud-${port}`).value);
    const parity = document.getElementById(`parity-${port}`).value;
    
    // Validate inputs
    if (!validateConfiguration(baudRate, parity)) {
        showPortMessage(port, '❌ Invalid configuration parameters', 'error');
        return;
    }
    
    try {
        showPortMessage(port, 'Configuring port...', 'info');
        
        const response = await fetch(`${API_BASE}/api/configure`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                port: port,
                baud_rate: baudRate,
                parity: parity
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPortMessage(port, `✅ ${data.message}`, 'success');
            // Update local config
            portConfigs[port] = data.config;
            // Re-render after a short delay
            setTimeout(() => {
                renderPortCards();
                updateConnectionStats();
            }, 1500);
            
            console.log(`Port ${port} configured: ${baudRate} baud, ${parity} parity`);
        } else {
            showPortMessage(port, `❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error configuring port:', error);
        showPortMessage(port, '❌ Error configuring port - Backend connection failed', 'error');
    }
}

/**
 * Disconnect a specific UART port
 * @param {string} port - The port to disconnect
 */
async function disconnectPort(port) {
    try {
        showPortMessage(port, 'Disconnecting port...', 'info');
        
        const response = await fetch(`${API_BASE}/api/disconnect/${encodeURIComponent(port)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPortMessage(port, `✅ ${data.message}`, 'success');
            // Update local config
            portConfigs[port] = data.config;
            // Re-render after a short delay
            setTimeout(() => {
                renderPortCards();
                updateConnectionStats();
            }, 1500);
            
            console.log(`Port ${port} disconnected`);
        } else {
            showPortMessage(port, `❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error disconnecting port:', error);
        showPortMessage(port, '❌ Error disconnecting port - Backend connection failed', 'error');
    }
}

/**
 * Test a specific UART port connection
 * @param {string} port - The port to test
 */
async function testPort(port) {
    try {
        showPortMessage(port, 'Testing port connection...', 'info');
        
        const response = await fetch(`${API_BASE}/api/test/${encodeURIComponent(port)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPortMessage(port, `✅ ${data.message}`, 'success');
            console.log(`Port ${port} test successful`);
        } else {
            showPortMessage(port, `❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error testing port:', error);
        showPortMessage(port, '❌ Error testing port - Backend connection failed', 'error');
    }
}

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

/**
 * Update the refresh button state
 * @param {boolean} loading - Whether the app is currently loading
 */
function updateRefreshButton(loading) {
    const refreshText = document.getElementById('refresh-text');
    if (loading) {
        refreshText.innerHTML = '<span class="loading"></span> Loading...';
    } else {
        refreshText.innerHTML = '🔄 Refresh Port Status';
    }
}

/**
 * Update the connection status indicator
 * @param {string} status - The connection status ('connected', 'error', 'loading')
 * @param {string} text - The status text to display
 */
function updateConnectionStatus(status, text) {
    const indicator = document.getElementById('connection-indicator');
    const statusText = document.getElementById('connection-status');
    
    statusText.textContent = text;
    
    switch(status) {
        case 'connected':
            indicator.style.background = '#27ae60';
            break;
        case 'error':
            indicator.style.background = '#e74c3c';
            break;
        case 'loading':
            indicator.style.background = '#f39c12';
            break;
        default:
            indicator.style.background = '#95a5a6';
    }
}

/**
 * Update the connection statistics display
 */
function updateConnectionStats() {
    let connected = 0, disconnected = 0, errors = 0;
    
    Object.values(portConfigs).forEach(config => {
        switch(config.status) {
            case 'connected':
                connected++;
                break;
            case 'error':
                errors++;
                break;
            default:
                disconnected++;
        }
    });
    
    document.getElementById('connected-count').textContent = connected;
    document.getElementById('disconnected-count').textContent = disconnected;
    document.getElementById('error-count').textContent = errors;
}

/**
 * Render all port cards
 */
function renderPortCards() {
    const container = document.getElementById('ports-container');
    container.innerHTML = '';

    Object.keys(portConfigs).forEach(port => {
        const config = portConfigs[port];
        const card = createPortCard(port, config);
        container.appendChild(card);
    });
}

/**
 * Create a port configuration card
 * @param {string} port - The port name
 * @param {Object} config - The port configuration
 * @returns {HTMLElement} The created card element
 */
function createPortCard(port, config) {
    const card = document.createElement('div');
    card.className = `port-card ${config.status}`;
    
    card.innerHTML = `
        <div class="port-header">
            <div class="port-name">${port}</div>
            <div class="port-status status-${config.status}">${config.status}</div>
        </div>
        
        <div class="config-form">
            <div class="form-group">
                <label for="baud-${port}">Baud Rate</label>
                <select id="baud-${port}">
                    ${availableBaudRates.map(rate => 
                        `<option value="${rate}" ${rate === config.baud_rate ? 'selected' : ''}>${rate.toLocaleString()} bps</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="parity-${port}">Parity</label>
                <select id="parity-${port}">
                    ${availableParity.map(parity => 
                        `<option value="${parity}" ${parity === config.parity ? 'selected' : ''}>${parity.charAt(0).toUpperCase() + parity.slice(1)}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="config-summary">
                <h4>Current Configuration</h4>
                <div class="config-detail">
                    <span>Baud Rate:</span>
                    <span>${config.baud_rate.toLocaleString()} bps</span>
                </div>
                <div class="config-detail">
                    <span>Parity:</span>
                    <span>${config.parity.charAt(0).toUpperCase() + config.parity.slice(1)}</span>
                </div>
                <div class="config-detail">
                    <span>Flow Control:</span>
                    <span>Disabled</span>
                </div>
            </div>
            
            <div class="button-group">
                <button class="btn-primary" onclick="configurePort('${port}')">
                    ⚙️ Configure Port
                </button>
                <button class="btn-secondary" onclick="disconnectPort('${port}')">
                    🔌 Disconnect
                </button>
                <button class="btn-test" onclick="testPort('${port}')">
                    🔍 Test
                </button>
            </div>
            
            <div id="message-${port}" class="message"></div>
        </div>
    `;
    
    return card;
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

/**
 * Show a message for a specific port
 * @param {string} port - The port name
 * @param {string} message - The message to display
 * @param {string} type - The message type ('success', 'error', 'info')
 */
function showPortMessage(port, message, type) {
    const messageEl = document.getElementById(`message-${port}`);
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type} show`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, MESSAGE_TIMEOUT);
}

/**
 * Show a global message (appears at top-right of screen)
 * @param {string} message - The message to display
 * @param {string} type - The message type ('success', 'error', 'info')
 */
function showGlobalMessage(message, type) {
    // Create a temporary global message element
    const globalMsg = document.createElement('div');
    globalMsg.className = `message ${type} show`;
    globalMsg.textContent = message;
    globalMsg.style.position = 'fixed';
    globalMsg.style.top = '20px';
    globalMsg.style.right = '20px';
    globalMsg.style.zIndex = '1000';
    globalMsg.style.maxWidth = '400px';
    
    document.body.appendChild(globalMsg);
    
    setTimeout(() => {
        globalMsg.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(globalMsg)) {
                document.body.removeChild(globalMsg);
            }
        }, 400);
    }, GLOBAL_MESSAGE_TIMEOUT);
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate configuration parameters
 * @param {number} baudRate - The baud rate to validate
 * @param {string} parity - The parity setting to validate
 * @returns {boolean} True if configuration is valid
 */
function validateConfiguration(baudRate, parity) {
    // Validate baud rate
    if (!availableBaudRates.includes(baudRate)) {
        console.error('Invalid baud rate:', baudRate);
        return false;
    }
    
    // Validate parity
    if (!availableParity.includes(parity)) {
        console.error('Invalid parity:', parity);
        return false;
    }
    
    return true;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format a number with thousands separators
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get the current timestamp
 * @returns {string} ISO timestamp string
 */
function getCurrentTimestamp() {
    return new Date().toISOString();
}

// =============================================================================
// DEBUG AND LOGGING
// =============================================================================

/**
 * Log application state for debugging
 */
function logAppState() {
    console.log('=== UART Config App State ===');
    console.log('Port Configs:', portConfigs);
    console.log('Available Baud Rates:', availableBaudRates);
    console.log('Available Parity:', availableParity);
    console.log('Is Loading:', isLoading);
    console.log('API Base:', API_BASE);
    console.log('============================');
}

// Expose debug function to global scope for console access
window.logAppState = logAppState;

// =============================================================================
// EXPORT FOR MODULE SYSTEMS (if needed)
// =============================================================================

// For ES6 modules or CommonJS, uncomment as needed:
// export { loadPortConfigs, configurePort, disconnectPort, testPort };
// module.exports = { loadPortConfigs, configurePort, disconnectPort, testPort };