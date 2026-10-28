"""Teste de fumaça das telas, com Supabase falso (tests/e2e/mock-supabase.js).
Uso: python3 tests/e2e/smoke.py   (precisa de Playwright com Chromium)
"""
import http.server, threading, functools, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MOCK = open(os.path.join(ROOT, 'tests/e2e/mock-supabase.js')).read()
CONFIG = "window.TEUVET_CONFIG={supabaseUrl:'https://teste.supabase.co',supabaseAnonKey:'teste'};"

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_port}/index.html'

errors = []
def check(cond, msg):
    if not cond:
        errors.append(msg); print('FALHOU:', msg)
    else:
        print('ok:', msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.on('pageerror', lambda e: errors.append('erro JS: ' + str(e)))
    pg.route('**/supabase-js@*/+esm', lambda r: r.fulfill(body=MOCK, content_type='text/javascript'))
    pg.route('**/config.js', lambda r: r.fulfill(body=CONFIG, content_type='text/javascript'))
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.goto(BASE)

    # Login
    pg.wait_for_selector('#si-email')
    pg.fill('#si-email', 'naoexiste@teste.com'); pg.fill('#si-pass', 'x'); pg.click('button[type=submit]')
    pg.wait_for_selector('.alert-err')
    check('incorretos' in pg.inner_text('.alert-err'), 'mensagem de login inválido em português')
    pg.fill('#si-email', 'criador@teste.com'); pg.fill('#si-pass', 'segredo'); pg.click('button[type=submit]')
    pg.wait_for_selector('text=Categorias')
    check(pg.is_visible('a[href="#painel"]'), 'Criador vê o botão Painel')
    check('Cães · Gatos' in pg.inner_text('.grid2'), 'categorias listam as espécies do banco')

    # Nova patologia em duas espécies
    pg.goto(BASE + '#nova-doenca'); pg.wait_for_selector('#e-name')
    pg.fill('#e-name', 'Doença Exemplo'); pg.fill('#e-agent', 'Agente exemplo'); pg.fill('#e-synonyms', 'Exemplite')
    pg.check('input[data-spcheck="caes"]'); pg.check('input[data-spcheck="gatos"]')
    pg.fill('#c-etiologia', 'Texto geral de etiologia')
    pg.click('button[data-t="caes"]'); pg.fill('#c-sinais', 'febre, anemia')
    pg.click('button[data-t="gatos"]'); pg.fill('#c-sinais', 'apatia')
    pg.check('input[data-bind="surgical"]'); pg.fill('#pn-0', 'Procedimento exemplo')
    pg.click('button[data-st="publicar"]')
    pg.wait_for_function("location.hash.startsWith('#editar-')")
    pg.wait_for_selector('.badge.pub')
    check(len(pg.evaluate('window.__DB.disease_species')) == 2, 'gravou uma versão para cada espécie')
    check(len(pg.evaluate('window.__DB.disease_versions')) == 1, 'gravou no histórico de versões')

    # Página da patologia
    did = pg.evaluate("location.hash.slice(8)")
    pg.goto(BASE + '#doenca-' + did); pg.wait_for_selector('h1:has-text("Doença Exemplo")')
    check('febre, anemia' in pg.text_content('#app'), 'mostra os sinais de cães')
    check('Texto geral de etiologia' in pg.inner_text('#app'), 'usa o texto geral quando a espécie não tem o próprio')
    pg.click('button[data-sp="gatos"]')
    check('apatia' in pg.text_content('#app') and 'febre, anemia' not in pg.text_content('#app'), 'troca para a versão de gatos')
    check(pg.is_visible('text=Ler sobre cirurgia'), 'seção cirúrgica aparece')
    pg.click('button[data-act="fav"]'); pg.wait_for_timeout(200)
    check(len(pg.evaluate('window.__DB.favorites')) == 1, 'favorito salvo')
    pg.click('button[data-act="sugg-open"]'); pg.fill('#sg-text', 'Corrigir um trecho'); pg.click('form[data-form="sugg"] button[type=submit]')
    pg.wait_for_timeout(200)
    check(len(pg.evaluate('window.__DB.suggestions')) == 1, 'sugestão enviada')

    # Pesquisas
    pg.goto(BASE + '#pesquisar'); pg.wait_for_selector('#sq'); pg.fill('#sq', 'exenplo')
    check('Doença Exemplo' in pg.inner_text('#results'), 'pesquisa aceita erro de digitação')
    pg.click('button[data-mode="qs"]'); pg.fill('#sqs', 'febre, convulsão')
    txt = pg.inner_text('#results')
    check('Encontrado: febre' in txt and 'convulsão' in txt, 'pesquisa por sinais mostra encontrados e ausentes')

    # Espécie e painel
    pg.goto(BASE + '#esp-caes'); pg.wait_for_selector('.letter')
    check('Doença Exemplo' in pg.inner_text('#app'), 'patologia aparece na espécie')
    pg.goto(BASE + '#painel'); pg.wait_for_selector('.kpi')
    check(pg.inner_text('.kpi >> nth=0').startswith('1'), 'painel conta 1 patologia')
    pg.goto(BASE + '#painel-sugestoes'); pg.wait_for_selector('text=Corrigir um trecho')
    pg.click('button[data-act="sugg-toggle"]'); pg.wait_for_timeout(200)
    check(pg.evaluate('window.__DB.suggestions[0].status') == 'resolvida', 'sugestão marcada como resolvida')
    pg.goto(BASE + '#painel-especies'); pg.wait_for_selector('form[data-form="sp-add"]')
    pg.fill('#na-pequenos-x', 'Coelhos'); pg.click('form[data-cat="pequenos"][data-parent=""] button[type=submit]')
    pg.wait_for_selector('.sp-row:has-text("Coelhos")')
    check(True, 'espécie nova cadastrada')

    # Restaurar versão
    pg.goto(BASE + '#editar-' + did); pg.wait_for_selector('#e-name')
    pg.fill('#e-name', 'Nome alterado'); pg.click('button[data-st="rascunho"]'); pg.wait_for_timeout(300)
    pg.click('button[data-act="hist"]'); pg.wait_for_selector('button[data-act="restore"]')
    pg.click('button[data-act="restore"] >> nth=1'); pg.wait_for_timeout(400)
    check(pg.evaluate('window.__DB.diseases[0].name') == 'Doença Exemplo', 'restaurou a versão anterior')

    # Visual no celular, nos dois temas
    pg.goto(BASE + '#inicio'); pg.wait_for_selector('.grid2')
    pg.screenshot(path='/tmp/teuvet-inicio.png', full_page=True)
    pg.goto(BASE + '#doenca-' + did); pg.wait_for_selector('h1')
    pg.emulate_media(color_scheme='dark'); pg.screenshot(path='/tmp/teuvet-doenca-escuro.png', full_page=True)
    check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'sem rolagem lateral no celular')
    pg.emulate_media(color_scheme='light'); pg.set_viewport_size({'width': 1280, 'height': 900})
    pg.goto(BASE + '#painel'); pg.wait_for_selector('.kpi'); pg.screenshot(path='/tmp/teuvet-painel.png')
    b.close()

srv.shutdown()
print('\nResultado:', 'TUDO OK' if not errors else f'{len(errors)} problema(s)')
for e in errors: print(' -', e)
sys.exit(1 if errors else 0)
