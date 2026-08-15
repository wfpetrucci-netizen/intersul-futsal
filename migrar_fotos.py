"""
Script de migração: incorpora as fotos locais dos jogadores
como Base64 no arquivo dados_intersul.json.
Rode apenas uma vez antes de dar o commit.
"""
import os
import json
import base64

PASTA_BASE = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_DADOS = os.path.join(PASTA_BASE, "dados_intersul.json")
PASTA_FOTOS = os.path.join(PASTA_BASE, "fotos_jogadores")

with open(ARQUIVO_DADOS, "r", encoding="utf-8") as f:
    dados = json.load(f)

migrated = 0
skipped = 0

for jogador in dados.get("jogadores", []):
    jid = jogador["id"]
    nome = jogador.get("nome_completo", "")

    # Pula se já tem Base64 embutida
    if jogador.get("imagem_url", "").startswith("data:"):
        print(f"[SKIP] Jogador {jid} ({nome}) - já possui Base64.")
        skipped += 1
        continue

    for ext in ["jpeg", "jpg", "png", "webp"]:
        caminho = os.path.join(PASTA_FOTOS, f"{jid}.{ext}")
        if os.path.exists(caminho):
            with open(caminho, "rb") as img_f:
                conteudo = img_f.read()
            if ext in ("jpeg", "jpg"):
                mime = "image/jpeg"
            elif ext == "png":
                mime = "image/png"
            else:
                mime = "image/webp"
            b64 = base64.b64encode(conteudo).decode("utf-8")
            jogador["imagem_url"] = f"data:{mime};base64,{b64}"
            print(f"[OK] Jogador {jid} ({nome}) - foto incorporada ({len(conteudo)//1024} KB).")
            migrated += 1
            break
    else:
        print(f"[WARN] Jogador {jid} ({nome}) - sem foto local encontrada.")

with open(ARQUIVO_DADOS, "w", encoding="utf-8") as f:
    json.dump(dados, f, indent=2, ensure_ascii=False)

print(f"\nMigracao concluida: {migrated} fotos incorporadas, {skipped} ja estavam em Base64.")
