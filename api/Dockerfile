FROM python:3.12-slim

# Utilisateur non-root pour réduire la surface d'attaque
RUN useradd --create-home --shell /bin/bash app
WORKDIR /app

# Installer les deps en premier pour bénéficier du cache Docker
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Puis le code
COPY src/ ./src/

USER app

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health').read()" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
