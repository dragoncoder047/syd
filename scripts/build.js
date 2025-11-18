import * as esbuild from "esbuild";
import { rmSync } from "fs";

export function opt(name, mustString) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const option = process.argv[index + 1];
    if (option === undefined && mustString) throw "expected option after " + JSON.stringify(name);
    return option ?? true;
}

const outdir = "build";
rmSync(outdir, { recursive: true, force: true });

/** @type {esbuild.BuildOptions} */
const config = {
    bundle: true,
    sourcemap: true,
    keepNames: true,
    minify: !!opt("-m", false),
    metafile: true,
    platform: "browser",
    charset: "utf8",
    entryPoints: ["src/index.ts", "src/sydWorklet.ts"],
    format: "esm",
    target: "esnext",
    treeShaking: true,
    splitting: true,
    outdir,
    plugins: [
        {
            name: "mark_node:_as_external",
            setup(build) {
                build.onResolve({ filter: /^node:/ }, () => ({ external: true }))
            },
        }
    ],
};

if (opt("-w", false)) {
    config.plugins.push({
        name: "logger",
        setup(build) {
            build.onEnd(result => {
                if (result.errors.length == 0)
                    console.error(`[${new Date().toISOString()}] rebuilt ${config.outfile} success!`);
                else
                    console.error(`[${new Date().toISOString()}] failed to build ${config.outfile}!`)
            });
        },
    });
    await esbuild.context(config).then(ctx => ctx.watch());
}
else await esbuild.build(config);
