FROM python:3.11-slim

WORKDIR /opt/program
COPY requirements.txt /opt/program/requirements.txt
RUN pip install --no-cache-dir -r /opt/program/requirements.txt

COPY train.py /opt/program/train.py

# SageMaker training container entrypoint:
ENTRYPOINT ["python", "/opt/program/train.py"]
