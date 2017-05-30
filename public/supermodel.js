class Supermodel {
    constructor() {
        this.models = new Map();
    }

    register(model) {
        const self = this;

        if (this.models.has(model.key)) throw new Error(`${model.key} already registered`);

        model.elements = document.querySelectorAll(`[data-model=${model.key}]`);

        return model.load().then(() => {
            self.models.set(model.key, model);
        });
    }
}

class Model {
    constructor(options) {
        this.options = options || {};
        this.options.events = this.options.events || {};
        this.options.storage = this.options.storage || {};
        this.elements = [];

        if (!this.options.key) throw new Error("model must have a key");

        this._value = this.options.default;
        this.key = this.options.key;
    }

    get elements() {
        return this._elements;
    }

    set elements(values) {
        const self = this;
        self._elements = values;

        for(let element of self._elements) {
            if (element.constructor.name === "HTMLInputElement") {
                element.addEventListener("change", (event) => {
                    self.value = event.target.value;
                });
            }
        }
    }

    sync(val) {
        for(let element of this.elements) {
            if (element.constructor.name === "HTMLInputElement") {
                element.value = val;
            } else {
                if (this.options.render) {
                    this.options.render(element, val);
                } else {
                    element.innerHTML = val;
                }
            }
            element.dataset[this.key] = val;
        }
    }

    get events() {
        const self = this;
        return {
            modified: (val) => {
                if (self.options.events.modified) {
                    self.options.events.modified(val);
                }

                if (self.options.autosave) {
                    self.save();
                }

                self.sync.call(self, val);
            },
            loaded: (val) => {
                if (self.options.events.loaded) {
                    self.options.events.loaded(val);
                }

                self.sync.call(self, val);
            },
            saved: (val) => {
                if (self.options.events.saved) {
                    self.options.events.saved(val);
                }

                self.sync.call(self, val);
            },
            removed: (val) => {
                if (self.options.events.removed) {
                    self.options.events.removed(val);
                }

                self.sync.call(self, val);
            }
        };
    }

    get value() {
        return this._value;
    }

    set value(value) {
        if (value !== this._value) {
            this._new_value = value;
            this.events.modified(this._new_value);
        }
    }

    save() {
        const self = this;

        let promise = null;

        let val = (self._new_value && self._value !== self._new_value) ? self._new_value : self._value;

        if (self.options.storage.save) {
            promise = self.options.storage.save(self.key, val);
        } else {
            promise = new Promise((resolve) => {
                resolve(val);
            });
        }

        return promise.then((value) => {
            self._value = value;
            self._new_value = undefined;

            self.events.saved.call(self, value);
            return value;
        });
    }

    load() {
        const self = this;

        let loadPromise = null;

        if (self.options.storage.load) {
            loadPromise = self.options.storage.load(self.key, self.value)

        } else {
            loadPromise = new Promise((resolve) => {
                resolve(self.value);
            });
        }

        return loadPromise.then((value) => {
            self._value = value;
            self._new_value = undefined;

            self.events.loaded(value);
            return value;
        });
    }

    remove() {
        const self = this;

        let promise = null;

        if (self.options.storage.remove) {
            promise = self.options.storage.remove(self.key, self.value)

        } else {
            promise = new Promise((resolve) => {
                resolve(self.value);
            });
        }

        return promise.then((value) => {
            self._value = undefined;
            self._new_value = undefined;

            self.events.removed(value);
            return value;
        });
    }
}
