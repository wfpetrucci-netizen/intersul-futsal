# Arquivo WSGI para o PythonAnywhere
import sys
import os

# Adiciona o diretório do projeto ao path
PASTA_PROJETO = os.path.dirname(os.path.abspath(__file__))
if PASTA_PROJETO not in sys.path:
    sys.path.insert(0, PASTA_PROJETO)

from a2wsgi import ASGIMiddleware
from main import app

# Converte o app FastAPI (ASGI) em WSGI compatível com PythonAnywhere
application = ASGIMiddleware(app)
