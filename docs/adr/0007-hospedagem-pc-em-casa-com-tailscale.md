# ADR 0007 — Hospedagem: PC em casa com Tailscale

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** humano (decisão dele: PC local, domínio grátis, celular Android)

## Contexto
O plano deixou em aberto onde hospedar (VPS ou máquina em casa) e qual o celular. O humano escolheu usar o próprio
PC e quer um domínio gratuito; o celular é Android.

## Decisão
- O compose do `infra/` roda no PC de casa. O Caddy atende só em HTTP (`DOMINIO=:80`), numa porta presa ao
  `127.0.0.1` (8080), e o **Tailscale** (`tailscale serve --bg 8080`) faz o HTTPS com o endereço gratuito
  `<pc>.<tailnet>.ts.net`, que só os aparelhos da conta Tailscale alcançam.
- Backup diário numa pasta sincronizada com a nuvem (Google Drive para computador), para não depender do disco do PC.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| **Tailscale (escolhida)** | Domínio e HTTPS grátis; sem abrir portas; funciona com CGNAT; acesso só dos seus aparelhos | Cada aparelho precisa do app Tailscale ligado para acessar |
| DuckDNS + abrir portas 80/443 | Acesso de qualquer lugar, sem app extra | Muitas operadoras usam CGNAT (não recebe conexões); expõe o PC na internet |
| Cloudflare Tunnel | Sem abrir portas | Precisa de domínio próprio na Cloudflare; túneis grátis sem domínio mudam de endereço |
| VPS | Sempre ligado, independe de casa | Custo mensal; domínio próprio |

## Consequências
- Sincronização e (futuramente) lembretes dependem do PC ligado e sem suspender; offline, o app nos aparelhos segue
  funcionando e sincroniza quando o PC voltar.
- Web Push (lembretes) no Android funciona: o servidor só precisa de saída para a internet, e a notificação chega
  pelo serviço do Chrome mesmo com o Tailscale desligado no celular.
- O limite de tentativas de login conta todas as tentativas juntas (todas chegam pelo mesmo proxy local). Com um
  usuário só e acesso restrito à tailnet, é aceitável.
- Mudar para VPS depois é só trocar o `.env` (domínio público, portas 80/443) e restaurar um backup.
