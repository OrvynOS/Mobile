// Runs the Expo CLI from this app's folder with an upper-case drive letter on Windows. Started from a
// lower-case path (VS Code terminals open in "c:\..."), Expo Router builds its route paths as
// "c:\C:\...\app\..." and every bundle fails with "Unable to resolve module".
//   node scripts/expo.cjs start --go --lan
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..").replace(/^[a-z]:/, (d) => d.toUpperCase());
const child = spawn("npx", ["expo", ...process.argv.slice(2)], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
