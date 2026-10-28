# Meu Bolso

Aplicativo pessoal de controle financeiro com lançamentos manuais, painel mensal, gráficos, insights e sincronização entre dispositivos.

## Tecnologias

- GitHub Pages: hospedagem da interface estática.
- Firebase Authentication: login pela Conta Google.
- Cloud Firestore: banco de dados e sincronização dos lançamentos.
- PWA: instalação no dispositivo, cache do app shell e uso offline.
- HTML, CSS e JavaScript, sem etapa de build.

## Estrutura dos dados

Cada movimentação é armazenada em `users/{uid}/transactions/{transactionId}`, com:
- `type`: `expense` ou `income`
- `amountCents`: valor inteiro em centavos
- `date`: data local no formato `YYYY-MM-DD`
- `description`, `category`, `paymentMethod`, `cardName`
- `createdAt`, `updatedAt`: timestamps do Firebase

## Configuração do Firebase

O app web usa a configuração pública de `firebase-config.js`. Esses identificadores não substituem as regras de segurança: não publique credenciais administrativas, chaves de conta de serviço nem tokens privados.

Serviços necessários:
1. Firebase Authentication com provedor Google ativado.
2. Domínio `leviltonvilasboas-app.github.io` autorizado no Firebase Authentication.
3. Cloud Firestore criado e com regras de segurança publicadas.
4. Regra do Firestore que permite ao usuário acessar apenas `users/{uid}` e seus documentos subordinados.

## Publicação no GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Selecione a branch `main` e a pasta `/(root)`.
4. Clique em **Save**.

URL esperada: https://leviltonvilasboas-app.github.io/meu-bolso/

## Uso offline e privacidade

- O cache do Cloud Firestore permite consultar documentos previamente carregados e enfileirar gravações offline; elas são sincronizadas quando a conexão retorna.
- A primeira autenticação Google precisa de conexão.
- A persistência do Firestore pode manter uma cópia de dados no navegador. Use apenas dispositivos confiáveis; exporte CSVs periodicamente e não limpe o armazenamento do navegador sem backup.
- O botão **Exportar CSV** baixa as movimentações do período e dos filtros atuais.
- O projeto não usa integração bancária nem APIs pagas para calcular os insights básicos.

## Escopo atual

Incluído: lançamento manual de receitas e despesas, categorias predefinidas, forma de pagamento, identificação opcional do cartão, edição/exclusão, filtro mensal, busca, gráfico por categoria, insights baseados nos lançamentos, exportação CSV, login Google, sincronização Firestore e base PWA.

Próximas evoluções: categorias personalizadas, orçamento mensal, cartões com fechamento/vencimento, parcelas e relatórios históricos comparativos.
