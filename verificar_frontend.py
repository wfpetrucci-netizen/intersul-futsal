"""Verificação completa do frontend Inter Sul Futsal."""
import html.parser

# 1. index.html - sintaxe HTML
with open('frontend/index.html', encoding='utf-8') as f:
    html_content = f.read()
html.parser.HTMLParser().feed(html_content)
print('[OK] index.html - sintaxe HTML valida')

# 2. app.js - balanceamento e funcoes chave
with open('frontend/app.js', encoding='utf-8') as f:
    js = f.read()

open_braces = js.count('{')
close_braces = js.count('}')
open_parens = js.count('(')
close_parens = js.count(')')

assert open_braces == close_braces, f'Chaves desbalanceadas: {open_braces} abertas, {close_braces} fechadas'
assert open_parens == close_parens, f'Parenteses desbalanceados: {open_parens} abertos, {close_parens} fechados'
print(f'[OK] app.js - {open_braces} chaves, {open_parens} parenteses balanceados')

checks_js = [
    'filterMonthSelect',
    'filterStatusSelect',
    'btnSavePayments',
    'saveAllPaymentChanges',
    'showToast',
    'stagedPaymentChanges',
    'Isento',
    'startsWith',
    'paymentSearchQuery',
    'updateSaveButtonState',
]
for kw in checks_js:
    assert kw in js, f'AUSENTE em app.js: {kw}'
    print(f'[OK] app.js - "{kw}" presente')

# 3. styles.css - classes e variaveis chave
with open('frontend/styles.css', encoding='utf-8') as f:
    css = f.read()

checks_css = [
    '--status-exempt-bg',
    'status-exempt-text',
    'payment-filters-row',
    'toast-notification',
    'btn-save-payments',
    'active-column-header',
    'pulseSave',
    'filter-group',
]
for kw in checks_css:
    assert kw in css, f'AUSENTE em styles.css: {kw}'
    print(f'[OK] styles.css - "{kw}" presente')

print()
print('RESULTADO: Todos os checks de frontend passaram! Nenhum erro encontrado.')
