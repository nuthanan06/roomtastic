import asyncio
import os
import sys
import json
import argparse

try:
    from tripo3d import TripoClient, TaskStatus
except Exception as e:
    print(json.dumps({"error": f"Missing tripo3d library or import failed: {e}"}))
    sys.exit(2)

async def run(input_path: str, output_dir: str, prompt: str | None):
    api_key = os.environ.get('TRIPO_API_KEY')
    if not api_key:
        print(json.dumps({"error": "TRIPO_API_KEY not set in environment"}))
        return 2

    os.makedirs(output_dir, exist_ok=True)

    async with TripoClient(api_key=api_key) as client:
        # Build a prompt; include filename context if no explicit prompt
        prompt_text = prompt or f"Convert the provided product photo at {os.path.basename(input_path)} into a high-quality 3D model."

        try:
            task_id = await client.text_to_model(
                prompt=prompt_text,
                negative_prompt="low quality, blurry",
            )
        except Exception as e:
            print(json.dumps({"error": f"Failed to create task: {e}"}))
            return 3

        try:
            # do not enable verbose logging to stdout (it pollutes stdout JSON)
            task = await client.wait_for_task(task_id, verbose=False)
        except Exception as e:
            print(json.dumps({"error": f"Failed waiting for task: {e}"}))
            return 4

        if task.status != TaskStatus.SUCCESS:
            print(json.dumps({"error": f"Task failed or not successful: {task.status}"}))
            return 5

        try:
            files = await client.download_task_models(task, output_dir)
        except Exception as e:
            print(json.dumps({"error": f"Failed to download models: {e}"}))
            return 6

    # Normalize file paths and return JSON (write JSON only to stdout)
    out = {k: os.path.abspath(v) for k, v in files.items()} if files else {}
    sys.stdout.write(json.dumps({"success": True, "files": out}) + "\n")
    sys.stdout.flush()
    return 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate 3D model via Tripo')
    parser.add_argument('input_path')
    parser.add_argument('output_dir')
    parser.add_argument('--prompt', default=None)
    args = parser.parse_args()

    code = asyncio.run(run(args.input_path, args.output_dir, args.prompt))
    if isinstance(code, int) and code != 0:
        sys.exit(code)
