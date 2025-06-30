from flask import Flask, redirect, url_for, render_template
from flask_cors import CORS
import serial
import json
import os
import logging

# Our Flask app object
app = Flask(__name__, template_folder='../templates',
            static_folder='../static')

CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# UART port configuration
UART_PORTS = ['/dev/ttyAMA0', '/dev/ttyAMA1', '/dev/ttyAMA2']

# Valid configuration options
VALID_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
VALID_PARITY = ['none', 'even', 'odd']

# Store current configurations
uart_configs = {
    '/dev/ttyAMA0': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'},
    '/dev/ttyAMA1': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'},
    '/dev/ttyAMA2': {'baud_rate': 9600, 'parity': 'none', 'status': 'disconnected'}
}

# Active serial connections
active_connections = {}

def get_serial_parity(parity_str):
    """Convert parity string to pyserial parity constant"""
    parity_map = {
        'none': serial.PARITY_NONE,
        'even': serial.PARITY_EVEN,
        'odd': serial.PARITY_ODD
    }
    return parity_map.get(parity_str.lower(), serial.PARITY_NONE)

def configure_uart_port(port, baud_rate, parity):
    """Configure a UART port with specified parameters"""
    try:
        # Close existing connection if any
        if port in active_connections:
            active_connections[port].close()
            del active_connections[port]
        
        # Check if port exists
        if not os.path.exists(port):
            logger.warning(f"Port {port} does not exist")
            return False, f"Port {port} does not exist"
        
        # Create new serial connection
        ser = serial.Serial(
            port=port,
            baudrate=baud_rate,
            parity=get_serial_parity(parity),
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=1,
            xonxoff=False,  # Disable software flow control
            rtscts=False,   # Disable hardware flow control
            dsrdtr=False    # Disable DSR/DTR flow control
        )
        
        # Store the connection
        active_connections[port] = ser
        
        # Update configuration
        uart_configs[port]['baud_rate'] = baud_rate
        uart_configs[port]['parity'] = parity
        uart_configs[port]['status'] = 'connected'
        
        logger.info(f"Successfully configured {port}: {baud_rate} baud, {parity} parity")
        return True, f"Port {port} configured successfully"
        
    except serial.SerialException as e:
        logger.error(f"Failed to configure {port}: {str(e)}")
        uart_configs[port]['status'] = 'error'
        return False, f"Failed to configure {port}: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error configuring {port}: {str(e)}")
        uart_configs[port]['status'] = 'error'
        return False, f"Unexpected error: {str(e)}"

@app.route('/')
@app.route('/index')
def index():
    """Our default routes of '/' and '/index'

    Return: The content we want to display to a user
    """

    return render_template('index.html')


@app.route('/<path:path>')
def catch_all(path):
    """A special route that catches all other requests

    Note: Let this be your last route. Priority is defined
    by order, so placing this above other functions will
    cause catch_all() to override then.

    Return: A redirect to our index route
    """

    return redirect(url_for('index'))

@app.route('/api/ports', methods=['GET'])
def get_ports():
    """Get current configuration of all UART ports"""
    return jsonify({
        'ports': uart_configs,
        'available_baud_rates': VALID_BAUD_RATES,
        'available_parity': VALID_PARITY
    })

@app.route('/api/configure', methods=['POST'])
def configure_port():
    """Configure a specific UART port"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        port = data.get('port')
        baud_rate = data.get('baud_rate')
        parity = data.get('parity')
        
        # Validate inputs
        if port not in UART_PORTS:
            return jsonify({'success': False, 'message': 'Invalid port specified'}), 400
        
        if baud_rate not in VALID_BAUD_RATES:
            return jsonify({'success': False, 'message': 'Invalid baud rate'}), 400
        
        if parity not in VALID_PARITY:
            return jsonify({'success': False, 'message': 'Invalid parity setting'}), 400
        
        # Configure the port
        success, message = configure_uart_port(port, baud_rate, parity)
        
        if success:
            return jsonify({
                'success': True, 
                'message': message,
                'config': uart_configs[port]
            })
        else:
            return jsonify({'success': False, 'message': message}), 500
            
    except Exception as e:
        logger.error(f"Error in configure_port: {str(e)}")
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/disconnect/<path:port>', methods=['POST'])
def disconnect_port(port):
    """Disconnect a specific UART port"""
    try:
        if port not in UART_PORTS:
            return jsonify({'success': False, 'message': 'Invalid port specified'}), 400
        
        # Close connection if exists
        if port in active_connections:
            active_connections[port].close()
            del active_connections[port]
        
        # Update status
        uart_configs[port]['status'] = 'disconnected'
        
        logger.info(f"Disconnected {port}")
        return jsonify({
            'success': True, 
            'message': f'Port {port} disconnected',
            'config': uart_configs[port]
        })
        
    except Exception as e:
        logger.error(f"Error disconnecting {port}: {str(e)}")
        return jsonify({'success': False, 'message': f'Error disconnecting port: {str(e)}'}), 500

@app.route('/api/test/<path:port>', methods=['POST'])
def test_port(port):
    """Test a UART port connection"""
    try:
        if port not in UART_PORTS:
            return jsonify({'success': False, 'message': 'Invalid port specified'}), 400
        
        if port not in active_connections:
            return jsonify({'success': False, 'message': 'Port not connected'}), 400
        
        ser = active_connections[port]
        
        # Simple test - check if port is open and readable
        if ser.is_open:
            return jsonify({
                'success': True, 
                'message': f'Port {port} is active and ready',
                'details': {
                    'baudrate': ser.baudrate,
                    'parity': ser.parity,
                    'is_open': ser.is_open
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Port is not open'}), 500
            
    except Exception as e:
        logger.error(f"Error testing {port}: {str(e)}")
        return jsonify({'success': False, 'message': f'Error testing port: {str(e)}'}), 500

if __name__ == '__main__':
    app.run()
