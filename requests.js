const Event = require("./event.js");

class Requests extends Map {

    constructor() {
        super();

        this.on = {
            adding: new Event(),
            added: new Event(),
            removing: new Event(),
            removed: new Event(),
            updating: new Event(),
            updated: new Event(),
        };
    }

    set(key, value) {
        let isNew = !super.has(key);
        if (isNew) {
            this.on.adding.fire(this, key, value);
        } else {
            this.on.updating.fire(this, key, value);
        }

        super.set(key, value);

        if (isNew) {
            this.on.added.fire(this, key, value);
        } else {
            this.on.updated.fire(this, key, value);
        }
    }

    delete(key) {
        this.on.removing.fire(this, key);

        super.delete(key);

        this.on.removed.fire(this, key);
    }
}

module.exports = Requests;
