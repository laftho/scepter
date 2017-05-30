const bunyan = require("bunyan");

let proxyLog = bunyan.createLogger({
    name: "proxy",
    stream: process.stdout,
    level: "info"
});

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const Proxy = require("./proxy");

const proxy = new Proxy(express(), {
    log: (obj, message) => {
        proxyLog.info(obj, message);
    },
    events: {
        listening: (config) => {
            console.log(`madhacks ${config.port}`);
        }
    }
});

proxy.config = {port:8080, sslport:8084, base: ""};

app.use(bodyParser.json());
app.use(express.static("./public"));
app.set("views", "./views");
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
    res.render("pages/index");
});

app.get("/status", (req, res) => {
    res.json(proxy.status);
});

app.post("/status", (req, res) => {
    if (req.body.proxy === "start") {
        proxy.start().then((status) => {
            res.json(status);
        });
    } else {
        proxy.stop().then((status) => {
            res.json(status);
        })
    }
});

let config = {
    proxy: {
        port: 8080,
        sslport: 8084,
        base: ""
    }
};

app.get("/config", (req, res) => {
    config.proxy = proxy.config;
    res.json(config);
});

app.post("/config", (req, res) => {
    config = Object.assign(config, req.body);
    proxy.config = config.proxy;
    res.json(config);
});

app.get("/rules", (req, res) => {
    res.json(proxy.rules);
});

app.post("/rules", (req, res) => {
    proxy.rules = Object.assign(proxy.rules, req.body);
    res.json(proxy.rules);
});

io.on("connection", (socket) => {
    console.log("socket connected");

    let requestAdded = (sender, key, request) => {
        socket.emit("request-added", request);
    };

    let requestUpdated = (sender, key, request) => {
        socket.emit("request-updated", request);
    };

    proxy.requests.on.added.add(requestAdded);
    proxy.requests.on.updated.add(requestUpdated);

    socket.on("disconnect", () => {
        proxy.requests.on.added.remove(requestAdded);
        proxy.requests.on.updated.remove(requestUpdated);
        console.log("disconnected");
    });
});

http.listen(8081, () => {
    console.log("web interface listening on 8081...");
});

