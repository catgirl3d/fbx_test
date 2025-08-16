class Logger {
    constructor() {
        if (Logger.instance) {
            return Logger.instance;
        }
        this.enabled = true;
        Logger.instance = this;
    }

    setEnabled(isEnabled) {
        this.enabled = isEnabled;
    }

    log(...args) {
        if (this.enabled) {
            console.log(...args);
        }
    }

    warn(...args) {
        if (this.enabled) {
            console.warn(...args);
        }
    }

    error(...args) {
        if (this.enabled) {
            console.error(...args);
        }
    }

    group(label) {
        if (this.enabled) {
            console.group(label);
        }
    }

    groupEnd() {
        if (this.enabled) {
            console.groupEnd();
        }
    }
}

const instance = new Logger();

export default instance;