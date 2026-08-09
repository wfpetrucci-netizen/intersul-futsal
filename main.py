# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Depends
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse, JSONResponse, Response
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import json
import base64
import shutil
from typing import Optional, Dict

app = FastAPI(title="Inter Sul Futsal API")

# Configurar middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PASTA_BASE = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_DADOS = os.path.join(PASTA_BASE, "dados_intersul.json")
PASTA_FOTOS = os.path.join(PASTA_BASE, "fotos_jogadores")

# Certifica-se de que a pasta de fotos existe (mantida para compatibilidade local)
os.makedirs(PASTA_FOTOS, exist_ok=True)

# Lista de Diretores Permitidos
DIRETORES = ["Wagner Fagundes", "Bruno Lopes", "Felipe de Sá"]
SENHA_ACESSO = "1996"

# Funções auxiliares para leitura/escrita do JSON
def ler_dados() -> dict:
    if not os.path.exists(ARQUIVO_DADOS):
        # Fallback de segurança caso o arquivo não exista
        return {"jogadores": [], "mensalidades": {}}
    with open(ARQUIVO_DADOS, "r", encoding="utf-8") as f:
        return json.load(f)

def salvar_dados(dados: dict):
    with open(ARQUIVO_DADOS, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=2, ensure_ascii=False)

# Modelos Pydantic
class LoginRequest(BaseModel):
    director: str
    passcode: str

class JogadorModel(BaseModel):
    nome_completo: str
    data_nascimento: str
    rg: str
    cpf: str
    posicao: str
    imagem_url: Optional[str] = ""

class MensalidadeUpdateRequest(BaseModel):
    mes: str
    status: str

class MensalidadeBatchItem(BaseModel):
    jogador_id: int
    mes: str
    status: str


# Dependência de Autenticação
def verificar_autenticacao(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado. Cabeçalho de autorização ausente ou malformatado.")
    
    token = authorization.split(" ", 1)[1]
    # O token será no formato: IntersulSession-<NomeDoDiretor>
    if not token.startswith("IntersulSession-"):
        raise HTTPException(status_code=401, detail="Token de sessão inválido.")
    
    nome_diretor = token.replace("IntersulSession-", "").replace("%20", " ").strip()
    try:
        nome_diretor = nome_diretor.encode("latin-1").decode("utf-8")
    except Exception:
        pass
        
    if nome_diretor not in DIRETORES:
        raise HTTPException(status_code=403, detail="Acesso não autorizado para este perfil.")
    
    return nome_diretor

# --- ENDPOINTS ---

# 1. Login
@app.post("/api/login")
def login(req: LoginRequest):
    if req.director not in DIRETORES:
        raise HTTPException(status_code=400, detail="Diretor não cadastrado.")
    if req.passcode != SENHA_ACESSO:
        raise HTTPException(status_code=401, detail="Senha de acesso incorreta.")
    
    # Gera um token simples baseado no nome do diretor
    token = f"IntersulSession-{req.director}"
    return {"token": token, "director": req.director}

# 2. Listar Jogadores
@app.get("/api/jogadores")
def listar_jogadores(diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    return dados.get("jogadores", [])

# 3. Adicionar Jogador
@app.post("/api/jogadores")
def criar_jogador(jogador: JogadorModel, diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    jogadores = dados.setdefault("jogadores", [])
    mensalidades = dados.setdefault("mensalidades", {})
    
    # Determina novo ID
    novo_id = 1 if not jogadores else max(j["id"] for j in jogadores) + 1
    
    novo_jogador = {
        "id": novo_id,
        "nome_completo": jogador.nome_completo,
        "data_nascimento": jogador.data_nascimento,
        "rg": jogador.rg,
        "cpf": jogador.cpf,
        "posicao": jogador.posicao,
        "imagem_url": jogador.imagem_url if jogador.imagem_url else ""
    }
    
    jogadores.append(novo_jogador)
    
    # Inicializa mensalidades para o novo jogador de maio a dezembro como 'Pendente'
    mensalidades[str(novo_id)] = {
        "maio": "Pendente",
        "junho": "Pendente",
        "julho": "Pendente",
        "agosto": "Pendente",
        "setembro": "Pendente",
        "outubro": "Pendente",
        "novembro": "Pendente",
        "dezembro": "Pendente"
    }
    
    salvar_dados(dados)
    return novo_jogador

# 4. Editar Jogador
@app.put("/api/jogadores/{id}")
def atualizar_jogador(id: int, jogador: JogadorModel, diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    jogadores = dados.get("jogadores", [])
    
    for j in jogadores:
        if j["id"] == id:
            j["nome_completo"] = jogador.nome_completo
            j["data_nascimento"] = jogador.data_nascimento
            j["rg"] = jogador.rg
            j["cpf"] = jogador.cpf
            j["posicao"] = jogador.posicao
            if jogador.imagem_url:
                j["imagem_url"] = jogador.imagem_url
            salvar_dados(dados)
            return j
            
    raise HTTPException(status_code=404, detail="Jogador não encontrado")

# 5. Excluir Jogador
@app.delete("/api/jogadores/{id}")
def remover_jogador(id: int, diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    jogadores = dados.get("jogadores", [])
    mensalidades = dados.get("mensalidades", {})
    
    # Filtra fora o jogador com o ID especificado
    dados["jogadores"] = [j for j in jogadores if j["id"] != id]
    
    # Remove também as mensalidades vinculadas
    if str(id) in mensalidades:
        del mensalidades[str(id)]
    
    # Remove arquivo de foto associado, se existir
    for ext in ["jpg", "jpeg", "png", "webp"]:
        caminho_foto = os.path.join(PASTA_FOTOS, f"{id}.{ext}")
        if os.path.exists(caminho_foto):
            try:
                os.remove(caminho_foto)
            except Exception:
                pass
                
    salvar_dados(dados)
    return {"detail": f"Jogador {id} removido com sucesso"}

# 6. Listar Mensalidades
@app.get("/api/mensalidades")
def listar_mensalidades(diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    return dados.get("mensalidades", {})

# 7. Atualizar Mensalidade de Jogador
@app.put("/api/mensalidades/{id}")
def atualizar_mensalidade(id: int, req: MensalidadeUpdateRequest, diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    mensalidades = dados.setdefault("mensalidades", {})
    
    str_id = str(id)
    if str_id not in mensalidades:
        raise HTTPException(status_code=404, detail="Jogador não possui mensalidades registradas.")
    
    meses_validos = ["maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    if req.mes not in meses_validos:
        raise HTTPException(status_code=400, detail="Mês inválido.")
        
    status_validos = ["Confirmado", "Pendente", "Em aberto", "Isento"]
    if req.status not in status_validos:
        raise HTTPException(status_code=400, detail="Status de mensalidade inválido.")
        
    mensalidades[str_id][req.mes] = req.status
    salvar_dados(dados)
    return {"jogador_id": id, "mes": req.mes, "status": req.status}

# 7.1. Atualizar Mensalidades em Lote
@app.put("/api/mensalidades/batch")
def atualizar_mensalidades_lote(items: list[MensalidadeBatchItem], diretor: str = Depends(verificar_autenticacao)):
    dados = ler_dados()
    mensalidades = dados.setdefault("mensalidades", {})
    meses_validos = ["maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    status_validos = ["Confirmado", "Pendente", "Em aberto", "Isento"]
    
    atualizados = 0
    for item in items:
        str_id = str(item.jogador_id)
        if str_id in mensalidades and item.mes in meses_validos and item.status in status_validos:
            mensalidades[str_id][item.mes] = item.status
            atualizados += 1
            
    salvar_dados(dados)
    return {"detail": "Mensalidades atualizadas em lote com sucesso.", "count": atualizados}


# 8. Upload de Foto do Jogador
# Salva como Base64 no JSON para garantir persistência em ambientes efêmeros (Render, etc.)
@app.post("/api/jogadores/{id}/foto")
async def upload_foto(id: int, file: UploadFile = File(...), diretor: str = Depends(verificar_autenticacao)):
    extensao = file.filename.split(".")[-1].lower()
    if extensao not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(status_code=400, detail="Apenas imagens JPG, JPEG, PNG ou WEBP são suportadas.")
    
    # Lê o arquivo em memória e converte para Base64
    conteudo = await file.read()
    if extensao in ("jpg", "jpeg"):
        mime = "image/jpeg"
    elif extensao == "png":
        mime = "image/png"
    else:
        mime = "image/webp"
    b64 = base64.b64encode(conteudo).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    # Persiste também em disco (útil localmente)
    try:
        for ext in ["jpg", "jpeg", "png", "webp"]:
            foto_antiga = os.path.join(PASTA_FOTOS, f"{id}.{ext}")
            if os.path.exists(foto_antiga):
                os.remove(foto_antiga)
        caminho_foto = os.path.join(PASTA_FOTOS, f"{id}.{extensao}")
        with open(caminho_foto, "wb") as buffer:
            buffer.write(conteudo)
    except Exception:
        pass

    # Salva a data URL no JSON do jogador (persistente)
    dados = ler_dados()
    for j in dados.get("jogadores", []):
        if j["id"] == id:
            j["imagem_url"] = data_url
            break
    salvar_dados(dados)
    
    return {"imagem_url": data_url}

# 9. Servir Foto do Jogador (compatibilidade com URLs antigas /api/jogadores/{id}/foto)
@app.get("/api/jogadores/{id}/foto")
def obter_foto_jogador(id: int):
    # Tenta servir do disco local (ambiente de desenvolvimento)
    for ext in ["jpg", "jpeg", "png", "webp"]:
        caminho_foto = os.path.join(PASTA_FOTOS, f"{id}.{ext}")
        if os.path.exists(caminho_foto):
            return FileResponse(caminho_foto)

    # Tenta servir da Base64 armazenada no JSON (ambiente de produção)
    dados = ler_dados()
    for j in dados.get("jogadores", []):
        if j["id"] == id and j.get("imagem_url", "").startswith("data:"):
            partes = j["imagem_url"].split(",", 1)
            if len(partes) == 2:
                header = partes[0]  # ex: data:image/jpeg;base64
                mime = header.split(":")[1].split(";")[0]
                img_bytes = base64.b64decode(partes[1])
                return Response(content=img_bytes, media_type=mime)

    # Retorna 404 se não houver foto
    raise HTTPException(status_code=404, detail="Foto de perfil não cadastrada.")

# Servir arquivos estáticos do frontend
PASTA_FRONTEND = os.path.abspath(os.path.join(PASTA_BASE, "..", "frontend"))
if not os.path.exists(PASTA_FRONTEND):
    PASTA_FRONTEND = os.path.join(PASTA_BASE, "frontend")
if os.path.exists(PASTA_FRONTEND):
    app.mount("/", StaticFiles(directory=PASTA_FRONTEND, html=True), name="frontend")
