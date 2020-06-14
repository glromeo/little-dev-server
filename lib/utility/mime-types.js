const db = require("mime-db");

const mimeTypes = new Map();

for (const contentType of Object.getOwnPropertyNames(db)) {
    const mimeType = db[contentType];
    if (mimeType.extensions) for (const ext of mimeType.extensions) {
        mimeTypes.set(ext, mimeType);
        mimeType.contentType = mimeType.charset ? `${contentType}; charset=${mimeType.charset}` : contentType;
    }
}

module.exports.contentType = (filename = "") => {
    const mimeType = mimeTypes.get(filename);
    if (mimeType) {
        return mimeType.contentType;
    }
    const dot = filename.lastIndexOf(".") + 1;
    if (dot > 0) {
        return mimeTypes.get(filename.substring(dot))?.contentType;
    }
};
