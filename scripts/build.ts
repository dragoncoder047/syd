import { rmSync } from "fs";

const outdir = "build";
rmSync(outdir, { recursive: true, force: true });

await Bun.build({
    sourcemap: true,
    minify: process.argv.includes("--minify"),
    entrypoints: ["src/index.ts", "src/sydWorklet.ts"],
    format: "esm",
    target: "browser",
    splitting: true,
    outdir,
});
