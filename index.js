const bunyan = require("bunyan");

let proxyLog = bunyan.createLogger({
    name: "proxy",
    stream: process.stdout,
    level: "info"
});

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
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

proxy.config = {port:8080};

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

app.listen(8081, () => {
    console.log("web interface listening on 8081...");
});

