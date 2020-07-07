module.exports.vary = function (res, header) {
    const values = res.getHeader("Vary");
    if (!values) {
        res.setHeader("Vary", header);
    } else if (values.indexOf(header) === -1) {
        res.setHeader("Vary", values + ", " + header);
    }
}