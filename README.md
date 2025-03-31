# Chess Piece Production Data Visualization

This project provides a real-time visualization of the Machine V2 (https://zenodo.org/records/7958478) data, including position, speed, torque, and power consumption. The visualization is hosted on the TUM server and can be accessed through a web interface.

## Features

- Real-time 3D visualization of CNC machine movements
- Color-coded speed and torque visualization
- Power consumption monitoring (axes and coolant)
- Historical data tracking
- Interactive 3D controls
- Multiple visualization modes (speed/torque)

## How to run

1. Connect to the TUM Lehre server:
```bash
ssh ge27tuq@lehre.bpm.in.tum.de
```
or use configured ssh: 
```bash
ssh tum-bpm
```
2. Navigate to the public_html directory:
```bash
cd public_html
```

3. Start the server:
```bash
node server.js
```

The visualization will be available at:
```
https://lehre.bpm.in.tum.de/ports/8333/
```

Note: The server must be running to receive and display data from the CPEE instance. The server is configured to accept data from "Machining V2" and "Machining V2 Alternative" instances.

## Run locally:
To run the application locally, some lines have to be uncommented in the code. After that follow these steps:

1. Active Port Forwarding
```bash
ssh tum-bpm -R 8333:localhost:8080
```
2. Go to local directory and start server
```bash
node server.js
```
The visualization will be available at:
```
https://localhost:8080/
```

## Usage

1. Open the visualization in your web browser
2. Enter the instance ID in the input field
3. Click "Connect" to start receiving data
4. Use the visualization controls:
   - Left mouse button: Rotate view
   - Right mouse button: Pan view
   - Mouse wheel: Zoom in/out
   - Mode buttons: Switch between speed and torque visualization

## Data Display

The visualization shows:
- Current position (X, Y, Z coordinates)
- Speed values  
- Torque values 
- Power consumption (axes and coolant)
- ToolIdent (current tool)
- Historical data in the right panel

## Technical Details

- The server runs on port 8333 on the server
- Data is received through POST requests from the CPEE instance
- The visualization uses Three.js for 3D rendering
- Real-time updates are handled through Server-Sent Events (SSE)

## Server Status

The server is configured to:
- Accept data from "Machining V2" and "Machining V2 Alternative" instances
- Process and normalize incoming data
- Maintain a history of data points
- Stream data to connected clients in real-time

## Development

The project consists of:
- `server.js`: Main server handling data reception and streaming
- `public/index.html`: Frontend visualization interface
- `public/`: Static assets and client-side code

## Dependencies

- Node.js
- Express.js
- Three.js
- Multer (for handling POST requests) 