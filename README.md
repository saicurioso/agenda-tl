# Agenda TL

Portal gratuito e mobile-first de eventos de Três Lagoas/MS.

## Stack
- GitHub Pages (hospedagem estática gratuita)
- Supabase (banco, autenticação e Storage)
- HTML/CSS/JavaScript sem framework

## Funcionalidades
- Agenda pública com busca e filtros
- Categorias carregadas do Supabase
- Eventos aprovados em tempo real
- Favoritos locais no navegador
- Envio público de eventos para moderação
- Painel administrativo com login
- Aprovação/recusa de envios
- PWA instalável

## Segurança
A chave presente em `config.js` é a Publishable Key do Supabase, própria para uso no navegador. O acesso aos dados é limitado por RLS. Nenhuma Service Role Key é enviada ao frontend.
