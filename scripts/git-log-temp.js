const { execSync } = require('child_process');

try {
  console.log("=== GIT LOG ===");
  const output = execSync('git log -n 15 --oneline', { encoding: 'utf-8' });
  console.log(output);
} catch (err) {
  console.error("Failed to run git log:", err.message);
}
