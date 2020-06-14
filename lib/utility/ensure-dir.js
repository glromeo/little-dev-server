const fs = require("fs")

module.exports.ensureDirSync = function (dirpath) {
    try {
        fs.mkdirSync(dirpath, {recursive: true});
        return dirpath;
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}
