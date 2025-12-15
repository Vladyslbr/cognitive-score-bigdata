import json
from flask import Flask, Response, request

app = Flask(__name__)

@app.get("/ping")
def ping():
    return Response(response="OK", status=200, mimetype="text/plain")

@app.post("/invocations")
def invocations():
    # SageMaker sends the request body here. We ignore it for mock.
    _ = request.get_data(as_text=True)
    payload = {"cognitive_score": 72, "model_version": "v1-mock"}
    return Response(
        response=json.dumps(payload),
        status=200,
        mimetype="application/json",
    )

if __name__ == "__main__":
    # SageMaker expects port 8080
    app.run(host="0.0.0.0", port=8080)
