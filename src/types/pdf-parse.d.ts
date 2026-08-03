// pdf-parse ships no type declarations; the extractor imports it dynamically and narrows the shape
// at the call site (src/lib/files/extractors.ts). This ambient module keeps `import("pdf-parse")`
// type-checkable without pulling in an untyped default.
declare module "pdf-parse";
