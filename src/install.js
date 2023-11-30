import { execSync } from 'child_process';
const dependencies = ["octokit",
    "--save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint",
    "--save dotenv @types/dotenv --save-dev"];
for (const pkg of dependencies) {
    try {
        execSync(`npm install ${pkg}`);
    }
    catch (_a) {
        //console.error(`Error installing dependency ${pkg}`);
        console.error(`Error: unable to install dependency ${pkg}`);
        process.exit(1);
    }
}
