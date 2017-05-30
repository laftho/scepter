const uuid = require("node-uuid");
const Requests = require("./requests.js");
const http = require("http");
const https = require("https");
const fs = require("fs");
const net = require("net");
const compression = require("compression");
const url = require("url");
const Chronometer = require("express-chrono")().Chronometer;
const bodyParser = require("body-parser");

class Proxy {
    constructor(app, options) {
        this.app = app;
        this.rules = [];
        const self = this;

        this.app.use(compression());
        app.use(bodyParser.raw());
        app.use(bodyParser.urlencoded());
        app.use(bodyParser.text());
        app.use(bodyParser.json());


        this.app.listen = (port, callback) => {
            let server = http.createServer(self.app);
            let httpsServer = https.createServer({
                key: fs.readFileSync('key.pem'),
                cert: fs.readFileSync('cert.pem')
            }, self.app).listen(self.app.get("sslport"));

            server.on("connect", (request, clientSocket, head) => {
                let reqUrl = url.parse(`http://${request.url}`);

                console.log(`CONNECT ${request.url}`);

                const serverSocket = net.connect(self.app.get("sslport"), "localhost", () => {
                    clientSocket.on("error", (err) => {
                        console.error(`CONNECT ${request.url}\n${err}`);
                    });

                    serverSocket.on("error", (err) => {
                        console.error(`CONNECT ${request.url}\n${err}`);
                    });

                    clientSocket.write(
                        "HTTP/1.1 200 Connection Established\r\n" +
                        "Proxy-agent: scepter/1.1\r\n" +
                        "\r\n"
                    );

                    serverSocket.write(head);
                    serverSocket.pipe(clientSocket);
                    clientSocket.pipe(serverSocket);
                });
            });

            return server.listen(port, callback);
        };

        this.options = options || {};
        this.options.events = this.options.events || {};
        this.server = null;
        this.request = options.request || require("superagent");

        this.requests = new Requests();

        this.app.use((req, res, next) => {
            if (!req.chrono) {
                req.chrono = new Chronometer();
                req.chrono.start();
            }

            req.scepterId = uuid.v4();
            self.requests.set(req.scepterId, {
                scepterId: req.scepterId,
                req: {
                    url: req.originalUrl,
                    method: req.method,
                    protocol: req.protocol,
                    hostname: req.hostname,
                    cookies: req.cookies,
                    headers: req.headers,
                    scepterId: req.scepterId,
                    body: (req.body) ? JSON.stringify(req.body) : "empty"
                },
                res: {}
            });

            next();
        });

        this.app.use((req, res, next) => {
            let reqUrl = url.parse(req.originalUrl);

            let protocol = reqUrl.protocol || (req.client.encrypted) ? "https:" : "http:";
            let host = reqUrl.host || req.headers["host"];
            let path = reqUrl.path || "/";

            reqUrl = url.parse(`${protocol}//${host}${path}`);

            for (let rule of self.rules) {
                if (!rule.before) continue;
                let re = new RegExp(rule.pattern);
                if (re.test(reqUrl.href)) {
                    let delegate = (req, res) => {
                        return eval(`(function() { ${rule.code} });`)();
                    };

                    if (delegate(req, res) > 0) {
                        return;
                    }
                }
            }

            let action;

            switch(req.method) {
                case "GET":
                    action = self.request.get(reqUrl.href);
                    break;
                case "POST":
                    action = self.request.post(reqUrl.href);
                    break;
                case "HEAD":
                    action = self.request.head(reqUrl.href);
                    break;
                case "PUT":
                    action = self.request.put(reqUrl.href);
                    break;
                default:
                    action = self.request.get(reqUrl.href);
                    break;
            }

            action = action.set(req.headers);
            action = action.set("X-Forwarded-For", req.ip);

            if ((req.method === "POST" || req.method === "PUT") && req.body) {
                action = action.send(req.body);
            }

            action.timeout({response:120000}).end((err, resp) => {
                req.chrono.stop();

                for (let rule of self.rules) {
                    if (!rule.after) continue;
                    let re = new RegExp(rule.pattern);
                    if (re.test(reqUrl.href)) {
                        let delegate = (req, res) => {
                            return eval(`(function() { ${rule.code} });`)();
                        };

                        if (delegate(req, res) > 0) {
                            return;
                        }
                    }
                }

                if (err) {
                    if (err.response) {
                        resp = err.response;
                    } else {
                        console.log(err);

                        let dat = self.requests.get(req.scepterId);
                        dat.res.status = 504;
                        dat.res.text = err;
                        dat.res.hrtime = req.chrono.valueOf();

                        self.requests.set(req.scepterId, dat);

                        res.status(504);
                        res.send(err);
                        next();
                        return;
                    }
                }

                let dat = self.requests.get(req.scepterId);
                dat.res.status = resp.status;
                dat.res.headers = resp.header;
                dat.res.text = resp.text;
                dat.res.hrtime = req.chrono.valueOf();

                self.requests.set(req.scepterId, dat);

                res.status(resp.status);
                let headers = Object.assign({}, resp.header);
                if (headers["content-encoding"]) {
                    delete headers["content-encoding"];
                }
                res.set(headers);

                res.set("Proxy-agent", "scepter/1.1");
                res.send(resp.text);
                next();
            });
        });
    }

    log(obj, message) {
        if (this.options.log) {
            this.options.log(obj, message);
        }
    }

    get status() {
        if (this.server) {
            if (this.server.listening) {
                return {
                    proxy: Proxy.RUNNING
                };
            }
        }

        return {
            proxy: Proxy.STOPPED
        }
    }

    get config() {
        return {
            port: this.app.get("port"),
            sslport: this.app.get("sslport"),
            base: this.app.get("base")
        };
    }

    set config(value) {
        let val = value || {};

        this.app.set("port", val.port);
        this.app.set("sslport", val.sslport);
        this.app.set("base", val.base);
    }

    start() {
        const self = this;

        return new Promise((resolve, reject) => {
            if (self.status.proxy === Proxy.STOPPED) {
                self.server = self.app.listen(self.app.get("port"), (err) => {
                    if (err) {
                        self.log(err, "server couldn't start");
                        reject(err);
                    }

                    new Promise((finish) => {
                        if (self.options.events.listening) {
                            self.options.events.listening(self.config, Proxy.RUNNING);
                        }

                        finish();
                    });

                    self.log(self.config, Proxy.RUNNING);

                    resolve(self.status);
                });
            } else {
                resolve(self.status);
            }
        });
    }

    stop() {
        const self = this;

        return new Promise((resolve, reject) => {
            if (self.status.proxy === Proxy.RUNNING) {
                self.server.close((err) => {
                    if (err) {
                        self.log(err, "server wasn't open but tried to close");
                        reject(err);
                    }

                    new Promise((resolve) => {
                        if (self.options.events.stopped)
                            self.options.events.stopped(self.config, Proxy.STOPPED);

                        resolve();
                    });

                    self.log(self.config, Proxy.STOPPED);
                    resolve(self.status);
                });
            } else {
                resolve(self.status);
            }
        });
    }
}

Proxy.RUNNING = "running";
Proxy.STOPPED = "stopped";

module.exports = Proxy;
