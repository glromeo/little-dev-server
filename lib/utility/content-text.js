const isStream = require("is-stream");
const getStream = require("get-stream");

module.exports = async function contentText(content) {

    if (typeof content === 'string') {
        return content;
    }

    if (Buffer.isBuffer(content)) {
        return content.toString();
    }

    if (isStream(content)) {
        return await getStream(content);
    }

    return content;
};

