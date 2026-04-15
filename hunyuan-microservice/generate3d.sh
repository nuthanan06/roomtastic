#!/bin/bash
ENDPOINT_ID="[ENDPOINT_ID]"
API_KEY="[API_KEY]"
IMAGE=$(base64 -i /Users/nuthanantharmarajah/Downloads/lamp_trial.webp | tr -d '\n')

JOB_ID=$(curl -s -X POST "https://api.runpod.ai/v2/${ENDPOINT_ID}/run" -H "Content-Type: application/json" -H "Authorization: Bearer ${API_KEY}" -d "{\"input\": {\"image\": \"${IMAGE}\", \"num_inference_steps\": 50, \"octree_resolution\": 384, \"texture\": true, \"seed\": 1234, \"guidance_scale\": 7.5, \"num_chunks\": 200000, \"face_count\": 80000}}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Job submitted: ${JOB_ID}"

while true; do
  RESPONSE=$(curl -s -H "Authorization: Bearer ${API_KEY}" "https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${JOB_ID}")
  STATUS=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: ${STATUS}"
  if [ "$STATUS" = "COMPLETED" ]; then
    echo $RESPONSE | python3 -c "import sys,json,base64; data=json.load(sys.stdin); glb=base64.b64decode(data['output']['model_base64']); open('/Users/nuthanantharmarajah/Downloads/lamp_serverless.glb','wb').write(glb); print('Done!')"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "Job failed: $RESPONSE"
    break
  fi
  sleep 10
done