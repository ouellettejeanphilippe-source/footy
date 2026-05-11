import argparse
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

def main():
    parser = argparse.ArgumentParser(description="Run python syntax checks.")
    parser.add_argument("--strict", action="store_true", help="Enable strict mode. Fails if no python files are found.")
    args = parser.parse_args()

    print("Running checks...")
    failed = False

    # Python scripts
    # We manually expand the glob and avoid shell=True
    # Add *.py to check the scripts in the root directory
    test_files = glob.glob("tests/*.py") + glob.glob("*.py")

    if not test_files:
        if args.strict:
            print("Strict mode enabled: No python files found, failing.")
            failed = True
        else:
            # If no files found, we follow the previous '|| true' logic of not failing
            print("No python files found, skipping syntax checks.")
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

if __name__ == "__main__":
    main()
