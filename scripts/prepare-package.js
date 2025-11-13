import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

delete packageJson.scripts;
delete packageJson.devDependencies;

fs.writeFileSync(
  path.join(__dirname, "../out/package.json"),
  JSON.stringify(packageJson, null, 2)
);

fs.copyFileSync("README.md", "out/README.md");
fs.copyFileSync("LICENSE", "out/LICENSE");