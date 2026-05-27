FROM python:3.11-slim

WORKDIR /app

COPY pipeline/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline/ .

CMD ["python", "-u", "pipeline.py", "--pages", "1", "--detail-limit", "50"]
