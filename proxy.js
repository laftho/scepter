class Proxy {
    constructor(app, options) {
        this.app = app;
        this.options = options || {};
        this.options.events = this.options.events || {};
        this.server = null;
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
            base: this.app.get("base")
        };
    }

    set config(value) {
        let val = value || {};

        this.app.set("port", val.port);
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
