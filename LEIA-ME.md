# ClickFood — cantina com retirada no balcão

Protótipo de um "iFood sem entrega" para a cantina da faculdade.

## Como abrir
Dê duplo clique em `index.html` ou rode um servidor estático na pasta:

```bash
python -m http.server 5530
```

e acesse http://localhost:5530.

## Acessos de demonstração
| Perfil | E-mail | Senha |
|---|---|---|
| Cantina (administrador) | admin@cantina.com | cantina123 |
| Aluno | aluno@faculdade.com | aluno123 |

Alunos novos podem se cadastrar na aba **Criar conta** (nome, e-mail e senha).

## Fluxo
1. **Cantina** cadastra o cardápio (nome, categoria, preço, foto ou ícone, disponível/esgotado).
2. **Aluno** monta o carrinho e paga (Pix ou cartão — **simulado**). Recebe um código de 4 caracteres.
3. O pedido chega no painel da cantina: **Novos → Em preparo → No balcão**. Cada mudança avisa o aluno no chat.
4. Na retirada, o aluno informa o código no balcão ou manda pelo **chat** do pedido. A cantina confere (o chat detecta o código automaticamente) e confirma a retirada.

Dica: abra uma aba como cantina e outra como aluno para ver pedidos e mensagens chegando em tempo real.

## Limitações do protótipo
- Os dados ficam no `localStorage` do navegador (sem servidor): só são compartilhados entre abas do mesmo navegador.
- Senhas guardadas sem criptografia e pagamento apenas simulado.
- Próximo passo: conectar um banco de dados (ex.: Supabase) para que aluno e cantina usem aparelhos diferentes.
- Botão **Restaurar dados de demonstração** no fim da tela de Pedidos da cantina.
