import * as esbuild from "esbuild";
import { opt } from "./com";
import { rmSync } from "fs";

const outdir = "build";
rmSync(outdir, { recursive: true, force: true });

const config: esbuild.BuildOptions = {
    bundle: true,
    sourcemap: true,
    keepNames: true,
    minify: !!opt("-m", false),
    metafile: true,
    platform: "browser",
    charset: "utf8",
    entryPoints: ["src/index.ts", "src/sydWorklet.ts", "src/esbuildPlugin/index.ts"],
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
    config.plugins!.push({
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
