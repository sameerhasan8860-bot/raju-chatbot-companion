// Fixed workflow, never accepted from AI output. No secrets or tokens enter the container.
export const WORKFLOW_NAME = "telegram-sandbox.yml";
export const WORKFLOW = `name: Telegram temporary test
run-name: telegram-4{{ inputs.job_id }}
on:
  workflow_dispatch:
    inputs:
      job_id:
        required: true
        type: string
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - name: Prepare fixed sandbox
        run: |
          python3 - <<'PY'
          import json, pathlib
          p = json.loads(pathlib.Path('execution.json').read_text())
          root = pathlib.Path('sandbox')
          root.mkdir()
          for f in p['files']:
              path = pathlib.PurePosixPath(f['path'])
              assert not path.is_absolute() and all(x and not x.startswith('.') for x in path.parts)
              target = root / path
              target.parent.mkdir(parents=True, exist_ok=True)
              target.write_text(f['content'])
          (root / 'run-test.sh').write_text(p['test_command'] + '\\n')
          if p['runtime'] == 'python':
              docker = 'FROM python:3.12-slim\\nWORKDIR /app\\nCOPY . .\\nRUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi\\nENV PYTHONDONTWRITEBYTECODE=1\\n'
          else:
              docker = 'FROM node:22-bookworm-slim\\nWORKDIR /app\\nCOPY . .\\nRUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; elif [ -f package.json ]; then npm install --ignore-scripts; fi\\n'
          (root / 'Dockerfile').write_text(docker + 'USER 65534:65534\\nCMD ["sh", "run-test.sh"]\\n')
          PY
      - name: Install dependencies inside image
        run: timeout 480 docker build -t telegram-test ./sandbox
      - name: Run isolated test (no network or secrets)
        run: |
          set +e
          timeout 300 docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges --memory 512m --cpus 1 --pids-limit 128 --read-only --tmpfs /tmp:rw,nosuid,size=64m telegram-test > test-output.log 2>&1
          result=$?
          tail -c 20000 test-output.log
          echo "Test exit status: $result"
          exit "$result"
`;