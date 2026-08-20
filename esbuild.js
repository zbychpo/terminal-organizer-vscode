const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const web = process.argv.includes('--web');

// Node core modules that have a drop-in browser replacement already in devDependencies.
// `require.resolve('buffer')`/`'assert'` would short-circuit to Node's own built-in of the
// same name instead of the npm package, so force filesystem resolution with a trailing slash.
const nodeBuiltinPolyfills = {
    assert: require.resolve('assert/'),
    buffer: require.resolve('buffer/'),
    constants: require.resolve('constants-browserify'),
    crypto: require.resolve('crypto-browserify'),
    events: require.resolve('events/'),
    os: require.resolve('os-browserify'),
    path: require.resolve('path-browserify'),
    process: require.resolve('process/browser'),
    stream: require.resolve('stream-browserify'),
    string_decoder: require.resolve('string_decoder/'),
    timers: require.resolve('timers-browserify'),
};

// Node core modules (bare and `node:`-prefixed) that are referenced by dependencies but never
// actually invoked on the web-extension code path; stub them out instead of polyfilling.
const nodeBuiltinEmptyShims = ['fs', 'fs/promises', 'child_process', 'net', 'tls', 'dns', 'url'];

/** @type {import('esbuild').Plugin} */
const nodeBuiltinPolyfillPlugin = {
    name: 'node-builtin-polyfill',
    setup(build) {
        for (const [mod, resolved] of Object.entries(nodeBuiltinPolyfills)) {
            build.onResolve({ filter: new RegExp(`^(node:)?${mod}$`) }, () => ({ path: resolved }));
        }
        for (const mod of nodeBuiltinEmptyShims) {
            build.onResolve({ filter: new RegExp(`^(node:)?${mod}$`) }, () => ({ path: mod, namespace: 'empty-shim' }));
        }
        build.onLoad({ filter: /.*/, namespace: 'empty-shim' }, () => ({ contents: 'module.exports = {};' }));
    }
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: web ? 'browser' : 'node',
        outfile: web ? 'dist/web/extension.js' : 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        mainFields: ['module', 'main'],
        inject: web ? ['./build/esbuild-shims.js'] : undefined,
        plugins: [
            /* add to the end of plugins array */
            ...(web ? [nodeBuiltinPolyfillPlugin] : []),
            esbuildProblemMatcherPlugin
        ]
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('Build started...');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.info('Build finished!');
        });
    }
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
