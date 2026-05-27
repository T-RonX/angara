const Encore = require('@symfony/webpack-encore');
const path = require('path');

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath('public/build/')
    .setPublicPath(Encore.isDevServer() ? 'http://localhost:4101/build' : '/build')
    .setManifestKeyPrefix('build/')

    .addEntry('app', './assets/src/main.ts')

    .splitEntryChunks()

    .enableVueLoader()

    .enableSingleRuntimeChunk()

    .cleanupOutputBeforeBuild()

    .enableSourceMaps(true)

    .enableVersioning(Encore.isProduction())

    .configureBabelPresetEnv((config) => {
        config.useBuiltIns = 'usage';
        config.corejs = '3.38';
    })

    .enableTypeScriptLoader(function(config) {
        config.configFile = 'assets/tsconfig.app.json';
        config.transpileOnly = true;
        config.experimentalWatchApi = true;
        // Explicitly disable all declaration/map generation
        config.compilerOptions = {
            declaration: false,
            declarationMap: false,
            sourceMap: false,
            noEmit: true,
            noEmitOnError: true,
            emitDeclarationOnly: false
        };
    })

    .addAliases({
        '@': path.resolve(__dirname, 'assets/src')
    })

    .configureDevServerOptions(options => {
        options.host = '0.0.0.0';
        options.port = 4101;
        options.allowedHosts = 'all';

        options.client = {
            webSocketURL: {
                hostname: 'localhost',
                port: 4101,
                protocol: 'ws',
            },
        };
    })
;

let config = Encore.getWebpackConfig();

// Add DefinePlugin for import.meta.env support
const webpack = require('webpack');
config.plugins.push(
    new webpack.DefinePlugin({
        'import.meta.env.BASE_URL': JSON.stringify('/')
    })
);

// Explicitly ensure devtool is set for webpack source maps only
config.devtool = Encore.isProduction() ? false : 'source-map';

module.exports = config;
