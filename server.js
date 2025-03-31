const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Normalize URL by removing query string and setting default file
    let url = req.url.split('?')[0];
    if (url === '/') {
        url = '/index.html';
    }

    // Get the file path
    const filePath = path.join(__dirname, url);

    // Get the file extension
    const ext = path.extname(filePath);

    // Set the content type based on file extension
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read the file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // If the file doesn't exist, return 404
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
                return;
            }

            // For other errors, return 500
            res.writeHead(500);
            res.end('500 Internal Server Error');
            return;
        }

        // Otherwise, return the file
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('To play the game on your mobile device:');
    console.log('1. Make sure your computer and mobile device are on the same network');
    console.log('2. Find your computer\'s local IP address (e.g., 192.168.1.x)');
    console.log(`3. On your mobile device, navigate to http://YOUR_IP_ADDRESS:${PORT}/`);
});
