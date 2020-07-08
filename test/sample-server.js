const http = require('http');

const server = http.createServer((request, response) => {
    response.setHeader("Last-Modified", new Date());
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Powered-By': 'bacon'
    });
    response.end();
}).listen(8080);

http.get('http://localhost:8080', (resp) => {
    let data = '';
    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
        data += chunk;
    });
    // The whole response has been received. Print out the result.
    resp.on('end', () => {
        console.log(JSON.parse(data).explanation);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
