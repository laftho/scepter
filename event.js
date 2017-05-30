class Event {
    constructor() {
        this.listeners = [];
    }

    add(listener) {
        this.listeners.push(listener);
    }

    remove(listener) {
        let index = this.listeners.findIndex(listener);

        if (index >= 0)
            this.listeners.splice(index, 1);
    }

    clear() {
        this.listeners = [];
    }

    fire(sender, ...args) {
        let promises = [];
        this.listeners.forEach((listener) => {
            promises.push(new Promise((resolve, reject) => {
                try {
                    listener(sender, ...args);
                    resolve();
                } catch(ex) {
                    reject(ex);
                }
            }));
        });

        if (promises.length > 0) Promise.all(promises);
    }
}

module.exports = Event;
