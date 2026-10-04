# Configuração Meta — De Rolê

A integração técnica já está preparada. Falta somente criar/configurar o aplicativo na Meta e autorizar a conta.

## URLs do projeto
- Site: https://saicurioso.github.io/agenda-tl/
- Política de Privacidade: https://saicurioso.github.io/agenda-tl/privacy.html
- Exclusão de Dados (página): https://saicurioso.github.io/agenda-tl/data-deletion.html
- Data Deletion Callback: https://tliyhcuryiprxnonlrtj.supabase.co/functions/v1/meta-data-deletion
- OAuth Redirect URI: https://tliyhcuryiprxnonlrtj.supabase.co/functions/v1/meta-oauth-callback

## O que criar na Meta
1. Acesse Meta for Developers e crie um aplicativo para o De Rolê.
2. Configure uma solução compatível com Facebook Login for Business / Instagram API with Facebook Login.
3. Adicione o Instagram profissional do De Rolê e vincule-o a uma Página do Facebook.
4. Em configurações básicas, informe a URL da Política de Privacidade.
5. Configure a URL de exclusão de dados/callback.
6. Adicione o OAuth Redirect URI acima entre os redirects válidos.
7. As permissões mínimas preparadas no fluxo são:
   - pages_show_list
   - pages_read_engagement
   - instagram_basic
8. Para consultar conteúdo público de Páginas de terceiros, solicite Page Public Content Access no App Review.
9. Para uso em contas de terceiros fora das funções de teste/admin do app, solicite Advanced Access quando exigido pela Meta.

## Depois de criar o App
1. Abra o painel do De Rolê.
2. Na seção “Radar social”, cole o Meta App ID e o Meta App Secret.
3. Clique em “Salvar no cofre”.
4. Clique em “Conectar Facebook / Instagram”.
5. Autorize a conta que administra a Página vinculada ao Instagram profissional.
6. Cadastre perfis/Páginas locais como fontes.
7. Clique em “Testar coleta agora”.

## Segurança
- App Secret e tokens não ficam no frontend.
- O App Secret é salvo no Supabase Vault.
- Tokens das Páginas também são salvos no Vault.
- O OAuth usa state de uso único com expiração.
- A exclusão automática da Meta valida a assinatura antes de apagar conexões.

## Limitação esperada antes do App Review
Durante desenvolvimento, a Meta normalmente restringe acesso a contas/Páginas ligadas a pessoas com papel no aplicativo. Conteúdo público amplo de terceiros só fica disponível quando as permissões/recursos correspondentes forem aprovados.
