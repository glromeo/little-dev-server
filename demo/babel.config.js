/**
 * api.env() invalidates the cache only when process.env.NODE_ENV (or the envName programmatic option) changes
 * using api.env api.cache is not necessary and generates an error if present.
 *
 * @param api
 * @return {*}
 */
module.exports = {
    plugins: [
        ["@babel/plugin-proposal-decorators", {decoratorsBeforeExport: true}],
        ["@babel/plugin-proposal-class-properties"]
    ]
};
