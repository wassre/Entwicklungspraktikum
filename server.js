const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = 8080;

// Helper function to add timestamps to logs
function logWithTimestamp(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, ...args);
}

// Global position variables
let lastKnownPosition = {
    x: null,
    y: null,
    z: null
};

const dataBuffer = [];  // Store data history
const MAX_BUFFER_SIZE = 10000;  
const clients = [];

// Configure multer for memory storage
const upload = multer();

app.use(express.static('public')); 

// SSE endpoint for live data streaming
app.get('/stream', (req, res) => {
    const instanceId = req.query.instance;  
    
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    // Store client connection with its instance ID
    const client = { res, instanceId };
    clients.push(client);
    logWithTimestamp('Client connected to stream for instance:', instanceId);

    // Send historical data from buffer
    const instanceData = dataBuffer.filter(data => data.instance === instanceId);
    //logWithTimestamp(`Sending ${instanceData.length} historical data points to new client`);
    instanceData.forEach(data => {
        const sseFormatted = `data: ${JSON.stringify(data)}\n\n`;
        client.res.write(sseFormatted);
    });

    req.on('close', () => {
        clients.splice(clients.indexOf(client), 1);
        logWithTimestamp('Client disconnected from instance:', instanceId);
    });
});

// Add query parameter handling for the main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Modify the POST handler to use the instance ID from the client
app.post('/', upload.none(), (req, res) => {
    logWithTimestamp('Received POST request');
    try {
        const notification = JSON.parse(req.body.notification);
        
        logWithTimestamp('Instance name:', notification['instance-name']);

        // Skip if not Machining V2 or Machining V2 Alternative
        if (notification['instance-name'] !== 'Machining V2' && notification['instance-name'] !== 'Machining V2 Alternative') {
            logWithTimestamp(`Skipping - not Machining V2 or Machining V2 Alternative (got ${notification['instance-name']})`);
            return res.status(200).send('OK');
        }

        //logWithTimestamp('Parsed notification:', notification);

        if (notification.name === 'extraction') {
            // Create a Map to store data by timestamp
            let timestampGroups = new Map();

            // Process each point
            notification.datastream.forEach((entry) => {
                if (entry['stream:point']) {
                    const point = entry['stream:point'];
                    const id = point['stream:id'];
                    const value = point['stream:value'];
                    const timestamp = point['stream:timestamp'];

                    // Create new sensorData object for this timestamp if it doesn't exist
                    if (!timestampGroups.has(timestamp)) {
                        timestampGroups.set(timestamp, {
                            timestamp: timestamp,
                            instance: notification.instance.toString(),
                            position: { x: null, y: null, z: null },
                            speed: { x: null, y: null, z: null },
                            power: { axes: null, coolant: null},
                            torque: { x: null, y: null, z: null },
                            programState: null
                        });
                    }

                    // Get the sensorData object for this timestamp
                    const sensorData = timestampGroups.get(timestamp);

                    // Position data - update lastKnownPosition
                    if (id.includes('Axes/X/aaLeadP')) {
                        if (value !== null && !isNaN(value)) {
                            lastKnownPosition.x = value;
                        }
                        sensorData.position.x = value || lastKnownPosition.x;
                    }
                    else if (id.includes('Axes/Y/aaLeadP')) {
                        if (value !== null && !isNaN(value)) {
                            lastKnownPosition.y = value;
                        }
                        sensorData.position.y = value || lastKnownPosition.y;
                    }
                    else if (id.includes('Axes/Z/aaLeadP')) {
                        if (value !== null && !isNaN(value)) {
                            lastKnownPosition.z = value;
                        }
                        sensorData.position.z = value || lastKnownPosition.z;
                    }

                    // Speed data
                    else if (id.includes('Axes/X/aaVactB')) sensorData.speed.x = value;
                    else if (id.includes('Axes/Y/aaVactB')) sensorData.speed.y = value;
                    else if (id.includes('Axes/Z/aaVactB')) sensorData.speed.z = value;

                    // Power consumption
                    else if (id.includes('MaxxTurn45/Axes/Power/Active/Sum')) sensorData.power.axes = value;
                    else if (id.includes('MaxxTurn45/Coolant/Power/Active/Sum')) sensorData.power.coolant = value;
                    // else if (id.includes('sys_active_power')) sensorData.power.system = value; Could not find appropriate values in the logs

                    // Torque data
                    else if (id.includes('Axes/X/aaTorque')) sensorData.torque.x = value;
                    else if (id.includes('Axes/Y/aaTorque')) sensorData.torque.y = value;
                    else if (id.includes('Axes/Z/aaTorque')) sensorData.torque.z = value;

                    // Program state
                    else if (id.includes('State/actToolIdent')) sensorData.programState = value; // In Absprache mit Herr Ehrendorfer, da "ProgStatus" durchgehend auf 3 bleibt
                }
            });

            // After processing all points, ensure we have valid positions for each timestamp
            timestampGroups.forEach(sensorData => {
                if (!sensorData.position.x && lastKnownPosition.x !== null) {
                    sensorData.position.x = lastKnownPosition.x;
                }
                if (!sensorData.position.y && lastKnownPosition.y !== null) {
                    sensorData.position.y = lastKnownPosition.y;
                }
                if (!sensorData.position.z && lastKnownPosition.z !== null) {
                    sensorData.position.z = lastKnownPosition.z;
                }
            });

            // Convert timestamp groups to array and sort by timestamp
            const sortedData = Array.from(timestampGroups.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Log each timestamp group's data
            /*
            logWithTimestamp('\nTimestamp Groups Data:');
            sortedData.forEach((sensorData, index) => {
                logWithTimestamp(`\nTimestamp ${index + 1}: ${sensorData.timestamp}`);
                logWithTimestamp('Position:', sensorData.position);
                logWithTimestamp('Speed:', sensorData.speed);
                logWithTimestamp('Power:', sensorData.power);
                logWithTimestamp('Torque:', sensorData.torque);
                logWithTimestamp('Program State:', sensorData.programState);
            });
            logWithTimestamp('\n');
            */

            // Track the last data point that was added to the buffer
            let lastStoredData = dataBuffer.length > 0 ? dataBuffer[dataBuffer.length - 1] : null;

            // Add sorted data to buffer and send to clients, only if values changed
            let addedPoints = 0;
            let skippedPoints = 0;

            sortedData.forEach(sensorData => {
                // Add instance ID to the data point
                sensorData.instance = notification.instance.toString();
                
                // Check if this data point is different from the last one stored to avoid duplicates
                const hasChanged = !lastStoredData || 
                    // Compare positions
                    lastStoredData.position.x !== sensorData.position.x ||
                    lastStoredData.position.y !== sensorData.position.y ||
                    lastStoredData.position.z !== sensorData.position.z ||
                    // Compare speeds
                    lastStoredData.speed.x !== sensorData.speed.x ||
                    lastStoredData.speed.y !== sensorData.speed.y ||
                    lastStoredData.speed.z !== sensorData.speed.z ||
                    // Compare torques
                    lastStoredData.torque.x !== sensorData.torque.x ||
                    lastStoredData.torque.y !== sensorData.torque.y ||
                    lastStoredData.torque.z !== sensorData.torque.z ||
                    // Compare powers
                    lastStoredData.power.axes !== sensorData.power.axes ||
                    lastStoredData.power.coolant !== sensorData.power.coolant ||
                    lastStoredData.power.system !== sensorData.power.system ||
                    // Compare program state
                    lastStoredData.programState !== sensorData.programState;

                if (hasChanged) {
                    // Store the data point in the buffer
                    dataBuffer.push(sensorData);
                    lastStoredData = sensorData;
                    addedPoints++;
                    
                    // Maintain buffer size
                    if (dataBuffer.length > MAX_BUFFER_SIZE) {
                        dataBuffer.shift();
                    }

                    // Send to all connected clients
                    const sseFormatted = `data: ${JSON.stringify(sensorData)}\n\n`;
                    clients.forEach(client => {
                        if (client.instanceId === notification.instance.toString()) {
                            client.res.write(sseFormatted);
                        }
                    });
                } else {
                    skippedPoints++;
                }
            });

            logWithTimestamp(`Added ${addedPoints} new data points, skipped ${skippedPoints} duplicate points.`);

            res.status(200).end();
        } else {
            logWithTimestamp(`Skipping - not an extraction event (${notification.event})`);
        }
    } catch (e) {
        logWithTimestamp('Failed to process notification:', e.message);
        res.status(400).json({ error: e.message });
    }
});

// Add endpoint to get data history
app.get('/data-history', (req, res) => {
  res.json(dataBuffer);
});

app.listen(PORT, () => {
  logWithTimestamp(`CPEE server running on http://localhost:${PORT}`);
});