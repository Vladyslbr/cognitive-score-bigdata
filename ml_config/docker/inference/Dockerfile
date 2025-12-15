FROM python:3.11-slim

WORKDIR /opt/program
COPY requirements.txt /opt/program/requirements.txt
RUN pip install --no-cache-dir -r /opt/program/requirements.txt

COPY app.py /opt/program/app.py

COPY serve /usr/local/bin/serve
RUN chmod +x /usr/local/bin/serve

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/serve"]
