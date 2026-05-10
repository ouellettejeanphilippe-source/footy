import subprocess
import sys
import glob

def run_cmd(cmd_list):
    """
    Runs a command securely without using a shell.
    """
    try:
        result = subprocess.run(cmd_list, capture_output=True, text=True, shell=False)
        if result.returncode != 0:
            print(f"Command failed: {' '.join(cmd_list)}\nOutput: {result.stdout}\nError: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"An error occurred while running the command: {e}")
        return False

print("Running checks...")
failed = False

# Python scripts
# We manually expand the glob and avoid shell=True
test_files = glob.glob("tests/*.py")

if not test_files:
    # If no files found, we follow the previous '|| true' logic of not failing
    print("No python files found in tests/, skipping syntax checks.")
    print("Python syntax checks passed")
else:
    # Use sys.executable to ensure we use the same python interpreter
    cmd = [sys.executable, "-m", "py_compile"] + test_files
    if run_cmd(cmd):
        print("Python syntax checks passed")
    else:
        # If compilation failed, we report it.
        print("Python syntax checks failed")
        failed = True

# Add any additional tests needed
print("All done!")

if failed:
    sys.exit(1)
else:
    sys.exit(0)
