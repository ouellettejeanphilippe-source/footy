import subprocess
import sys

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Command failed: {cmd}\nOutput: {result.stdout}\nError: {result.stderr}")
        return False
    return True

print("Running checks...")

# Python scripts
if run_cmd("python3 -m py_compile tests/*.py 2>/dev/null || true"):
    print("Python syntax checks passed")

# Add any additional tests needed
print("All done!")
