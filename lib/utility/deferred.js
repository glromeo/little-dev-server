module.exports.Deferred = class extends Promise {
    constructor(fn) {
        if (fn instanceof Function) {
            super(fn);
            return this;
        }
        let args;
        super(function() {
            args = arguments;
        });
        this.resolveAsync = args[0];
        this.rejectAsync = args[1];
    }
    resolve(value) {
        this.resolveAsync(value);
        return this;
    }
    reject(error) {
        this.rejectAsync(error);
        return this;
    }
}
