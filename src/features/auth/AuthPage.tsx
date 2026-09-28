import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/app/api";
import { useSession } from "@/app/session";

type Mode = "login" | "register" | "forgot" | "reset" | "confirm";

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, user } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "confirm") return;
    const token = params.get("token");
    if (!token) { setError("Link de confirmação inválido."); return; }
    api<{ message: string }>(`/auth/confirm-email?token=${encodeURIComponent(token)}`)
      .then((result) => setMessage(result.message))
      .catch((failure) => setError(failure.message));
  }, [mode, params]);

  useEffect(() => {
    if (user?.role === "STORE_OWNER" && mode === "login") navigate("/painel", { replace: true });
  }, [user, mode, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/painel");
      } else if (mode === "register") {
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ fullName: name, email, password, role: "STORE_OWNER" }),
        });
        setMessage("Conta criada. Confira seu e-mail para confirmar o acesso.");
      } else if (mode === "forgot") {
        await api("/auth/password/reset-request", {
          method: "POST", body: JSON.stringify({ email }),
        });
        setMessage("Se houver uma conta com este e-mail, enviaremos o link de redefinição.");
      } else if (mode === "reset") {
        const token = params.get("token");
        if (!token) throw new Error("Link de redefinição inválido.");
        await api("/auth/password/reset-confirm", {
          method: "POST", body: JSON.stringify({ token, newPassword: password }),
        });
        setMessage("Senha atualizada. Você já pode entrar.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const title = {
    login: "Entre na sua loja",
    register: "Crie sua loja",
    forgot: "Recupere seu acesso",
    reset: "Defina uma nova senha",
    confirm: "Confirme seu e-mail",
  }[mode];

  return (
    <div className="auth-screen">
      <div className="auth-aside">
        <Link className="brand" to="/"><img src="/favicon.png" alt="" />Pede<span>Fácil</span></Link>
        <p className="eyebrow">Seu canal de vendas diretas</p>
        <h1>Mais pedidos em ordem.<br /><em>Mais clientes de volta.</em></h1>
        <p>Cardápio, operação e relacionamento com o cliente no mesmo lugar.</p>
      </div>
      <main className="auth-main">
        <Link className="back-link" to="/">← Voltar ao início</Link>
        <div className="auth-card">
          <p className="eyebrow">Acesso do lojista</p>
          <h2>{title}</h2>
          {mode === "confirm" ? (
            <p>Estamos verificando seu link de confirmação.</p>
          ) : (
            <form onSubmit={submit}>
              {mode === "register" && (
                <label>Seu nome<input autoComplete="name" required minLength={2} value={name}
                  onChange={(event) => setName(event.target.value)} /></label>
              )}
              {["login", "register", "forgot"].includes(mode) && (
                <label>E-mail<input type="email" autoComplete="email" required value={email}
                  onChange={(event) => setEmail(event.target.value)} /></label>
              )}
              {["login", "register", "reset"].includes(mode) && (
                <label>Senha<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8} required value={password}
                  onChange={(event) => setPassword(event.target.value)} /></label>
              )}
              <button className="button button-primary" disabled={busy} type="submit">
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta"
                  : mode === "forgot" ? "Enviar link" : "Salvar nova senha"}
              </button>
            </form>
          )}
          {error && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message success" role="status">{message}</p>}
          <div className="auth-links">
            {mode !== "login" && <Link to="/entrar">Já tenho conta</Link>}
            {mode === "login" && <>
              <Link to="/cadastro">Criar loja</Link>
              <Link to="/esqueci-senha">Esqueci minha senha</Link>
            </>}
          </div>
        </div>
      </main>
    </div>
  );
}
