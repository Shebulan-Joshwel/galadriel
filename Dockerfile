# Works as-is on Hugging Face Spaces (Docker SDK), Render, Railway or any container host.
FROM python:3.11-slim
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV SPHEREX_CACHE_DIR=/tmp/spherex-cache
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
