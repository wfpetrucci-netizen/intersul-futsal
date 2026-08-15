"""Script de verificação completa dos endpoints do backend Inter Sul."""
import sys
sys.path.insert(0, '.')

import main
from main import (
    atualizar_mensalidade, atualizar_mensalidades_lote,
    obter_foto_jogador, ler_dados,
    MensalidadeUpdateRequest, MensalidadeBatchItem
)
from fastapi import HTTPException

erros = []
director = "Wagner Fagundes"

# 1. Status "Isento" individual
try:
    res = atualizar_mensalidade(1, MensalidadeUpdateRequest(mes='agosto', status='Isento'), diretor=director)
    assert res['status'] == 'Isento'
    print('[OK] atualizar_mensalidade aceita status Isento')
except Exception as e:
    erros.append(f'[ERRO] atualizar_mensalidade Isento: {e}')
    print(erros[-1])

# 2. Batch com Isento
try:
    items = [
        MensalidadeBatchItem(jogador_id=2, mes='agosto', status='Isento'),
        MensalidadeBatchItem(jogador_id=3, mes='julho', status='Confirmado'),
    ]
    res = atualizar_mensalidades_lote(items, diretor=director)
    assert res['count'] == 2
    print('[OK] atualizar_mensalidades_lote batch funcionando')
except Exception as e:
    erros.append(f'[ERRO] batch: {e}')
    print(erros[-1])

# 3. JSON tem fotos Base64
try:
    dados = ler_dados()
    jogadores_b64 = [j for j in dados['jogadores'] if j.get('imagem_url', '').startswith('data:')]
    assert len(jogadores_b64) > 0
    print(f'[OK] {len(jogadores_b64)} jogadores com foto Base64 no JSON')
except Exception as e:
    erros.append(f'[ERRO] fotos Base64: {e}')
    print(erros[-1])

# 4. GET /foto serve Base64 via endpoint (testa caminho Base64, não FileResponse do disco)
try:
    import base64
    dados = ler_dados()
    for j in dados['jogadores']:
        url = j.get('imagem_url', '')
        if url.startswith('data:'):
            jid = j['id']
            nome = j['nome_completo'][:20]
            # Simula ambiente Render: remove arquivo de disco temporariamente e chama endpoint
            import os
            from main import PASTA_FOTOS
            exts = ['jpg','jpeg','png','webp']
            arquivo_disco = None
            for ext in exts:
                p = os.path.join(PASTA_FOTOS, f'{jid}.{ext}')
                if os.path.exists(p):
                    arquivo_disco = p
                    break
            if arquivo_disco:
                os.rename(arquivo_disco, arquivo_disco + '.bkp')
            try:
                res_foto = obter_foto_jogador(jid)
                # Neste caminho, deve retornar Response (Base64), que tem .body
                assert hasattr(res_foto, 'body'), 'Resposta Base64 deve ter .body'
                kb = len(res_foto.body) // 1024
                print(f'[OK] GET /foto jogador {jid} ({nome}) via Base64 - {kb}KB OK')
            finally:
                if arquivo_disco:
                    os.rename(arquivo_disco + '.bkp', arquivo_disco)
            break
except Exception as e:
    erros.append(f'[ERRO] GET /foto Base64: {e}')
    print(erros[-1])

# 5. Status inválido é rejeitado
try:
    atualizar_mensalidade(1, MensalidadeUpdateRequest(mes='julho', status='StatusInvalido'), diretor=director)
    erros.append('[ERRO] Status invalido deveria ter sido rejeitado!')
    print(erros[-1])
except HTTPException as e:
    print(f'[OK] Status invalido rejeitado corretamente (HTTP {e.status_code})')
except Exception as e:
    print(f'[OK] Status invalido rejeitado: {e}')

# 6. Login válido e inválido
try:
    from main import login, LoginRequest
    res_login = login(LoginRequest(director=director, passcode='1996'))
    assert 'token' in res_login
    print('[OK] Login valido funcionando')

    try:
        login(LoginRequest(director=director, passcode='wrong'))
    except HTTPException as e:
        assert e.status_code == 401
        print('[OK] Login com senha errada rejeitado corretamente')
except Exception as e:
    erros.append(f'[ERRO] Login: {e}')
    print(erros[-1])

print()
if erros:
    print(f'RESULTADO: {len(erros)} erro(s) encontrado(s).')
    for err in erros:
        print(' -', err)
    sys.exit(1)
else:
    print('RESULTADO: Todos os testes passaram! Nenhum erro encontrado.')
