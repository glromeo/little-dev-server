const http = require("http");

const server = http.createServer((request, response) => {
    response.setHeader("Last-Modified", new Date().toUTCString());
    response.writeHead(200, {
        "Content-Type": "application/json",
        "X-Powered-By": "bacon"
    });
    response.end({
        data: 111000110010
    });
}).listen(8080);

http.get("http://localhost:8080", (resp) => {
    let data = "";
    resp.on("data", (chunk) => {
        data += chunk;
    });
    resp.on("end", () => {
        console.log(JSON.parse(data));
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
